// ===============================================
// ORBIT - Collaborative Whiteboard Canvas
// Microsoft Teams-Inspired Real-Time Whiteboard
// ===============================================

class CollaborativeWhiteboard {
    constructor(canvasId, socket, sessionId, userEmail, userRole, userName) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.socket = socket;
        this.sessionId = sessionId;
        this.userEmail = userEmail;
        this.userRole = userRole;
        this.userName = userName;
        
        // Drawing state
        this.isDrawing = false;
        this.hasPermission = userRole === 'faculty'; // Faculty always has permission
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.lineWidth = 2;
        this.lastX = 0;
        this.lastY = 0;
        
        // Remote users drawing state
        this.remoteDrawingState = new Map();
        
        this.initializeCanvas();
        this.setupSocketListeners();
        this.setupDrawingListeners();
        
        // Join whiteboard session
        this.joinSession();
    }
    
    initializeCanvas() {
        // Wait for DOM to be fully ready and CSS to apply
        setTimeout(() => {
            const container = this.canvas.parentElement;
            
            if (!container) {
                console.error('❌ Canvas container not found!');
                return;
            }
            
            console.log('📐 Container dimensions:', {
                width: container.clientWidth,
                height: container.clientHeight,
                offsetWidth: container.offsetWidth,
                offsetHeight: container.offsetHeight,
                scrollWidth: container.scrollWidth,
                scrollHeight: container.scrollHeight
            });
            
            // Force dimensions - use window size if container is zero
            let width = container.clientWidth;
            let height = container.clientHeight;
            
            if (width === 0 || height === 0) {
                console.warn('⚠️ Container has zero dimensions, using window-based fallback');
                // Use 90vw x 85vh as fallback (matching CSS)
                width = Math.floor(window.innerWidth * 0.9);
                height = Math.floor(window.innerHeight * 0.85) - 60; // Subtract header height
            }
            
            // Ensure minimum dimensions
            width = Math.max(width, 800);
            height = Math.max(height, 600);
            
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Set canvas style to ensure visibility
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.display = 'block';
            this.canvas.style.backgroundColor = '#ffffff';
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            
            // Set default styles
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.lineWidth;
            
            console.log('🎨 Canvas initialized:', {
                canvasWidth: this.canvas.width,
                canvasHeight: this.canvas.height,
                styleWidth: this.canvas.style.width,
                styleHeight: this.canvas.style.height,
                backgroundColor: this.canvas.style.backgroundColor,
                userRole: this.userRole,
                hasPermission: this.hasPermission
            });
            
            // Draw a test border to verify canvas is working
            this.ctx.strokeStyle = '#cccccc';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(5, 5, width - 10, height - 10);
            
            // Draw role indicator
            this.ctx.fillStyle = '#333';
            this.ctx.font = 'bold 20px Inter';
            this.ctx.fillText(`Role: ${this.userRole} | Permission: ${this.hasPermission ? 'Yes' : 'No'}`, 20, 40);
            
            // Reset to default color
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.lineWidth;
            
            console.log('✅ Test border drawn - canvas is visible and working');
        }, 200); // Increased delay to ensure CSS is fully applied
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        // Save current canvas content
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Resize canvas
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth || 800;
        this.canvas.height = container.clientHeight || 600;
        
        // Restore content
        this.ctx.putImageData(imageData, 0, 0);
        
        // Restore styles
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
    }
    
    joinSession() {
        this.socket.emit('whiteboard:join', {
            sessionId: this.sessionId,
            userEmail: this.userEmail,
            userRole: this.userRole,
            userName: this.userName
        });
        console.log('📋 Joined whiteboard session:', this.sessionId);
    }
    
    setupSocketListeners() {
        // Receive initial whiteboard state
        this.socket.on('whiteboard:state', (data) => {
            console.log('📥 Received whiteboard state');
            this.hasPermission = data.hasPermission;
            
            // Restore canvas state if exists
            if (data.canvasState) {
                const img = new Image();
                img.onload = () => {
                    this.ctx.drawImage(img, 0, 0);
                };
                img.src = data.canvasState;
            }
            
            // Update UI based on permission
            this.updatePermissionUI();
        });
        
        // Remote user started drawing
        this.socket.on('whiteboard:draw-start', (data) => {
            const { userId, x, y, color, lineWidth, tool } = data;
            this.remoteDrawingState.set(userId, {
                x, y, color, lineWidth, tool, isDrawing: true
            });
        });
        
        // Remote user drawing
        this.socket.on('whiteboard:draw', (data) => {
            const { userId, x, y } = data;
            const state = this.remoteDrawingState.get(userId);
            
            if (state && state.isDrawing) {
                this.drawLine(state.x, state.y, x, y, state.color, state.lineWidth);
                state.x = x;
                state.y = y;
            }
        });
        
        // Remote user stopped drawing
        this.socket.on('whiteboard:draw-end', (data) => {
            const { userId } = data;
            const state = this.remoteDrawingState.get(userId);
            if (state) {
                state.isDrawing = false;
            }
        });
        
        // Clear canvas
        this.socket.on('whiteboard:clear', () => {
            this.clearCanvas();
            console.log('🗑️ Canvas cleared by remote user');
        });
        
        // Permission updated
        this.socket.on('whiteboard:permission-updated', (data) => {
            if (data.studentEmail === this.userEmail) {
                this.hasPermission = data.granted;
                this.updatePermissionUI();
                
                const message = data.granted 
                    ? '✅ You now have permission to draw!'
                    : '❌ Your drawing permission has been revoked';
                this.showNotification(message);
            }
        });
        
        // Permission denied
        this.socket.on('whiteboard:permission-denied', (data) => {
            this.showNotification('⚠️ ' + data.message);
        });
        
        // User joined
        this.socket.on('whiteboard:user-joined', (data) => {
            console.log(`👤 ${data.userName} (${data.userRole}) joined whiteboard`);
        });
        
        // User left
        this.socket.on('whiteboard:user-left', (data) => {
            console.log(`👋 ${data.userName} left whiteboard`);
        });
        
        // Add shape
        this.socket.on('whiteboard:add-shape', (data) => {
            this.drawShape(data.shape);
        });
        
        // Undo
        this.socket.on('whiteboard:undo', () => {
            // For simplicity, we'll implement undo by clearing and redrawing
            // A more sophisticated approach would maintain a history stack
            console.log('↩️ Undo triggered');
        });
    }
    
    setupDrawingListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        
        // Touch events for mobile/tablet
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    
    startDrawing(e) {
        if (!this.hasPermission) {
            this.showNotification('⚠️ You do not have permission to draw');
            return;
        }
        
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        
        // Emit to server
        this.socket.emit('whiteboard:draw-start', {
            sessionId: this.sessionId,
            x: pos.x,
            y: pos.y,
            color: this.currentColor,
            lineWidth: this.lineWidth,
            tool: this.currentTool
        });
        
        // Start path
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }
    
    draw(e) {
        if (!this.isDrawing || !this.hasPermission) return;
        
        const pos = this.getMousePos(e);
        
        // Draw locally
        this.drawLine(this.lastX, this.lastY, pos.x, pos.y, this.currentColor, this.lineWidth);
        
        // Emit to server
        this.socket.emit('whiteboard:draw', {
            sessionId: this.sessionId,
            x: pos.x,
            y: pos.y
        });
        
        this.lastX = pos.x;
        this.lastY = pos.y;
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            // Emit to server
            this.socket.emit('whiteboard:draw-end', {
                sessionId: this.sessionId
            });
            
            // Save canvas state periodically
            this.saveCanvasState();
        }
    }
    
    drawLine(x1, y1, x2, y2, color, lineWidth) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    clearCanvasAndNotify() {
        if (this.userRole !== 'faculty') {
            this.showNotification('⚠️ Only faculty can clear the whiteboard');
            return;
        }
        
        this.socket.emit('whiteboard:clear', {
            sessionId: this.sessionId
        });
    }
    
    saveCanvasState() {
        const canvasData = this.canvas.toDataURL('image/png');
        this.socket.emit('whiteboard:save-state', {
            sessionId: this.sessionId,
            canvasData
        });
    }
    
    setTool(tool) {
        this.currentTool = tool;
        console.log('🖊️ Tool changed to:', tool);
    }
    
    setColor(color) {
        this.currentColor = color;
        this.ctx.strokeStyle = color;
        console.log('🎨 Color changed to:', color);
    }
    
    setLineWidth(width) {
        this.lineWidth = width;
        this.ctx.lineWidth = width;
        console.log('📏 Line width changed to:', width);
    }
    
    drawShape(shape) {
        const { type, x, y, width, height, radius, color, lineWidth } = shape;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        
        switch (type) {
            case 'rectangle':
                this.ctx.rect(x, y, width, height);
                break;
            case 'circle':
                this.ctx.arc(x, y, radius, 0, Math.PI * 2);
                break;
            case 'line':
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + width, y + height);
                break;
        }
        
        this.ctx.stroke();
    }
    
    grantPermission(studentEmail) {
        if (this.userRole !== 'faculty') return;
        
        this.socket.emit('whiteboard:grant-permission', {
            sessionId: this.sessionId,
            studentEmail
        });
        console.log('✅ Granted permission to:', studentEmail);
    }
    
    revokePermission(studentEmail) {
        if (this.userRole !== 'faculty') return;
        
        this.socket.emit('whiteboard:revoke-permission', {
            sessionId: this.sessionId,
            studentEmail
        });
        console.log('❌ Revoked permission from:', studentEmail);
    }
    
    updatePermissionUI() {
        const statusEl = document.getElementById('whiteboard-permission-status');
        if (statusEl) {
            if (this.hasPermission) {
                statusEl.textContent = '✅ You can draw';
                statusEl.style.color = '#4caf50';
            } else {
                statusEl.textContent = '🔒 View only (request permission from faculty)';
                statusEl.style.color = '#ff9800';
            }
        }
    }
    
    showNotification(message) {
        // Simple notification - can be enhanced with a toast library
        console.log('📢', message);
        
        // Create temporary notification element
        const notification = document.createElement('div');
        notification.className = 'whiteboard-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #333;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    destroy() {
        // Cleanup event listeners
        this.canvas.removeEventListener('mousedown', this.startDrawing);
        this.canvas.removeEventListener('mousemove', this.draw);
        this.canvas.removeEventListener('mouseup', this.stopDrawing);
        this.canvas.removeEventListener('mouseout', this.stopDrawing);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.stopDrawing);
        
        // Remove socket listeners
        this.socket.off('whiteboard:state');
        this.socket.off('whiteboard:draw-start');
        this.socket.off('whiteboard:draw');
        this.socket.off('whiteboard:draw-end');
        this.socket.off('whiteboard:clear');
        this.socket.off('whiteboard:permission-updated');
        this.socket.off('whiteboard:permission-denied');
        this.socket.off('whiteboard:user-joined');
        this.socket.off('whiteboard:user-left');
        
        console.log('🗑️ Whiteboard destroyed');
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Export for use in room.js
window.CollaborativeWhiteboard = CollaborativeWhiteboard;
