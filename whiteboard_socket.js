// ===============================================
// ORBIT - Collaborative Whiteboard Socket.IO Handler
// Microsoft Teams-Inspired Real-Time Whiteboard
// ===============================================

/**
 * Whiteboard Socket.IO Event Handlers
 * Manages real-time drawing synchronization, permissions, and canvas state
 * Uses MongoDB for persistence
 */

const WhiteboardState = require('./models/WhiteboardState');

// Rate limiting for drawing events (prevent spam)
const drawingRateLimit = new Map();
const MAX_DRAW_EVENTS_PER_SECOND = 60;

/**
 * Initialize or get whiteboard session state from MongoDB
 */
async function initializeWhiteboardSession(sessionId) {
    try {
        let session = await WhiteboardState.findOne({ sessionId });
        
        if (!session) {
            session = await WhiteboardState.create({
                sessionId,
                canvasData: null,
                drawingHistory: [],
                permissions: { allowedStudents: [] },
                lastUpdated: new Date()
            });
            console.log(`🎨 Created new whiteboard session in DB: ${sessionId}`);
        } else {
            console.log(`🎨 Loaded existing whiteboard session from DB: ${sessionId}`);
        }
        
        return session;
    } catch (error) {
        console.error('Error initializing whiteboard session:', error);
        throw error;
    }
}

/**
 * Check if user has permission to draw
 * Students require explicit permission, faculty always have permission
 */
async function hasDrawingPermission(sessionId, userEmail, userRole) {
    // Faculty always has permission
    if (userRole === 'faculty') return true;
    
    try {
        const session = await WhiteboardState.findOne({ sessionId });
        if (!session) return false;
        
        // Check if student has been granted permission
        return session.permissions.allowedStudents.includes(userEmail);
    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
}

/**
 * Rate limit check for drawing events
 */
function checkDrawingRateLimit(socketId) {
    const now = Date.now();
    const userEvents = drawingRateLimit.get(socketId) || [];
    
    // Remove events older than 1 second
    const recentEvents = userEvents.filter(time => now - time < 1000);
    
    if (recentEvents.length >= MAX_DRAW_EVENTS_PER_SECOND) {
        return false; // Rate limit exceeded
    }
    
    recentEvents.push(now);
    drawingRateLimit.set(socketId, recentEvents);
    return true;
}

/**
 * Setup whiteboard Socket.IO handlers
 */
function setupWhiteboardHandlers(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Whiteboard client connected: ${socket.id}`);
        
        // Join whiteboard session
        socket.on('whiteboard:join', async (data) => {
            const { sessionId, userEmail, userRole, userName } = data;
            
            socket.join(`whiteboard-${sessionId}`);
            socket.whiteboardSession = sessionId;
            socket.userEmail = userEmail;
            socket.userRole = userRole;
            socket.userName = userName;
            
            // Initialize session if doesn't exist
            const session = await initializeWhiteboardSession(sessionId);
            
            console.log(`📋 ${userName} (${userRole}) joined whiteboard: ${sessionId}`);
            
            // Check permission
            const hasPermission = await hasDrawingPermission(sessionId, userEmail, userRole);
            
            // Send current canvas state to new joiner
            socket.emit('whiteboard:state', {
                canvasState: session.canvasData,
                drawingHistory: session.drawingHistory,
                hasPermission
            });
            
            // Notify others that someone joined
            socket.to(`whiteboard-${sessionId}`).emit('whiteboard:user-joined', {
                userName,
                userRole,
                timestamp: new Date()
            });
        });
        
        // Drawing started
        socket.on('whiteboard:draw-start', async (data) => {
            const { sessionId, x, y, color, lineWidth, tool } = data;
            
            // Check permission
            const hasPermission = await hasDrawingPermission(sessionId, socket.userEmail, socket.userRole);
            if (!hasPermission) {
                socket.emit('whiteboard:permission-denied', {
                    message: 'You do not have permission to draw. Please request permission from faculty.'
                });
                return;
            }
            
            // Broadcast to others in the session
            socket.to(`whiteboard-${sessionId}`).emit('whiteboard:draw-start', {
                x, y, color, lineWidth, tool,
                userId: socket.id,
                userName: socket.userName
            });
        });
        
        // Drawing in progress
        socket.on('whiteboard:draw', async (data) => {
            const { sessionId, x, y } = data;
            
            // Check permission
            const hasPermission = await hasDrawingPermission(sessionId, socket.userEmail, socket.userRole);
            if (!hasPermission) return;
            
            // Rate limiting
            if (!checkDrawingRateLimit(socket.id)) {
                console.warn(`⚠️ Rate limit exceeded for ${socket.userName}`);
                return;
            }
            
            // Broadcast to others
            socket.to(`whiteboard-${sessionId}`).emit('whiteboard:draw', {
                x, y,
                userId: socket.id
            });
            
            // Store in history (throttled - every 10th event)
            try {
                const session = await WhiteboardState.findOne({ sessionId });
                if (session && session.drawingHistory.length % 10 === 0) {
                    session.drawingHistory.push({
                        type: 'draw',
                        data: { x, y },
                        timestamp: new Date()
                    });
                    await session.save();
                }
            } catch (error) {
                console.error('Error saving drawing history:', error);
            }
        });
        
        // Drawing ended
        socket.on('whiteboard:draw-end', (data) => {
            const { sessionId } = data;
            
            socket.to(`whiteboard-${sessionId}`).emit('whiteboard:draw-end', {
                userId: socket.id
            });
        });
        
        // Clear canvas
        socket.on('whiteboard:clear', async (data) => {
            const { sessionId } = data;
            
            // Only faculty can clear
            if (socket.userRole !== 'faculty') {
                socket.emit('whiteboard:permission-denied', {
                    message: 'Only faculty can clear the whiteboard'
                });
                return;
            }
            
            // Clear session data in MongoDB
            try {
                await WhiteboardState.findOneAndUpdate(
                    { sessionId },
                    {
                        canvasData: null,
                        drawingHistory: [],
                        lastUpdated: new Date()
                    }
                );
                
                // Broadcast to all in session (including sender)
                io.to(`whiteboard-${sessionId}`).emit('whiteboard:clear');
                
                console.log(`🗑️ Whiteboard cleared by ${socket.userName} in session ${sessionId}`);
            } catch (error) {
                console.error('Error clearing whiteboard:', error);
            }
        });
        
        // Save canvas state (for persistence)
        socket.on('whiteboard:save-state', async (data) => {
            const { sessionId, canvasData } = data;
            
            try {
                await WhiteboardState.findOneAndUpdate(
                    { sessionId },
                    {
                        canvasData,
                        lastUpdated: new Date()
                    },
                    { upsert: true }
                );
                console.log(`💾 Canvas state saved for session ${sessionId}`);
            } catch (error) {
                console.error('Error saving canvas state:', error);
            }
        });
        
        // Grant drawing permission to student
        socket.on('whiteboard:grant-permission', async (data) => {
            const { sessionId, studentEmail } = data;
            
            // Only faculty can grant permission
            if (socket.userRole !== 'faculty') {
                socket.emit('whiteboard:permission-denied', {
                    message: 'Only faculty can grant permissions'
                });
                return;
            }
            
            try {
                const session = await WhiteboardState.findOne({ sessionId });
                if (session) {
                    if (!session.permissions.allowedStudents.includes(studentEmail)) {
                        session.permissions.allowedStudents.push(studentEmail);
                        await session.save();
                        console.log(`✅ Drawing permission granted to ${studentEmail} in session ${sessionId}`);
                    }
                    
                    // Notify all clients about permission change
                    io.to(`whiteboard-${sessionId}`).emit('whiteboard:permission-updated', {
                        studentEmail,
                        granted: true
                    });
                }
            } catch (error) {
                console.error('Error granting permission:', error);
            }
        });
        
        // Revoke drawing permission from student
        socket.on('whiteboard:revoke-permission', async (data) => {
            const { sessionId, studentEmail } = data;
            
            // Only faculty can revoke permission
            if (socket.userRole !== 'faculty') {
                return;
            }
            
            try {
                const session = await WhiteboardState.findOne({ sessionId });
                if (session) {
                    session.permissions.allowedStudents = session.permissions.allowedStudents.filter(
                        email => email !== studentEmail
                    );
                    await session.save();
                    console.log(`❌ Drawing permission revoked from ${studentEmail} in session ${sessionId}`);
                    
                    // Notify all clients
                    io.to(`whiteboard-${sessionId}`).emit('whiteboard:permission-updated', {
                        studentEmail,
                        granted: false
                    });
                }
            } catch (error) {
                console.error('Error revoking permission:', error);
            }
        });
        
        // Add shape (rectangle, circle, line, text)
        socket.on('whiteboard:add-shape', async (data) => {
            const { sessionId, shape } = data;
            
            // Check permission
            const hasPermission = await hasDrawingPermission(sessionId, socket.userEmail, socket.userRole);
            if (!hasPermission) return;
            
            // Broadcast shape to others
            socket.to(`whiteboard-${sessionId}`).emit('whiteboard:add-shape', {
                shape,
                userId: socket.id,
                userName: socket.userName
            });
            
            // Store in history
            try {
                const session = await WhiteboardState.findOne({ sessionId });
                if (session) {
                    session.drawingHistory.push({
                        type: 'shape',
                        data: shape,
                        timestamp: new Date()
                    });
                    await session.save();
                }
            } catch (error) {
                console.error('Error saving shape:', error);
            }
        });
        
        // Undo last action
        socket.on('whiteboard:undo', async (data) => {
            const { sessionId } = data;
            
            // Check permission
            const hasPermission = await hasDrawingPermission(sessionId, socket.userEmail, socket.userRole);
            if (!hasPermission) return;
            
            // Broadcast undo to all
            io.to(`whiteboard-${sessionId}`).emit('whiteboard:undo', {
                userId: socket.id
            });
        });
        
        // Disconnect handler
        socket.on('disconnect', () => {
            if (socket.whiteboardSession) {
                socket.to(`whiteboard-${socket.whiteboardSession}`).emit('whiteboard:user-left', {
                    userName: socket.userName,
                    userRole: socket.userRole
                });
                console.log(`❌ ${socket.userName} left whiteboard: ${socket.whiteboardSession}`);
            }
            
            // Cleanup rate limit data
            drawingRateLimit.delete(socket.id);
        });
    });
}

module.exports = {
    setupWhiteboardHandlers,
    initializeWhiteboardSession,
    hasDrawingPermission
};
