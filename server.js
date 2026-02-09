// Importing core modules
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser"); // Optional, but included
const cookieParser = require("cookie-parser");
const path = require("path");
const { fork } = require("child_process");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express(); // Initialize Express App
const server = http.createServer(app); // Create HTTP server

//-------------------------------------------------------------
// 🔐 Middleware Setup
//-------------------------------------------------------------

// Parse cookies from frontend requests
app.use(cookieParser());

// Enable CORS so frontend (Angular) and video call can communicate with backend
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like file:// protocol or mobile apps)
      if (!origin) return callback(null, true);
      
      // Allowed origins
      const allowedOrigins = [
        'http://localhost:4200',  // Angular frontend
        'http://localhost:5000',  // Backend itself
        'http://127.0.0.1:4200',
        'http://127.0.0.1:5000'
      ];
      
      // Allow all localhost origins for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies / tokens
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

// Parse incoming JSON request bodies (instead of bodyParser.json())
app.use(express.json({ limit: "50mb" })); // Set limit to allow images / base64

//-------------------------------------------------------------
// 📌 Logging Middleware (for debugging each request)
//-------------------------------------------------------------
app.use((req, res, next) => {
  console.log(
    "Incoming Request =>",
    req.method,
    req.url,
    "Time:",
    new Date().toISOString()
  );
  next();
});

//-------------------------------------------------------------
// 🌍 MongoDB Connection
//-------------------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // Stop server if DB not connected
  });

//-------------------------------------------------------------
// 🚏 Import & Register Routes
//-------------------------------------------------------------

// Auth / Login / Signup
const authRoutes = require("./routes/auth");
const classRoutes = require("./routes/class");
const classesRoutes = require("./routes/classes");
const updatePasswordRoute = require("./routes/updatepassword");
const updateProfileRoute = require("./routes/updateprofile");
const classNameRoute = require("./routes/classname");
const studentJoinClassRoute = require("./routes/studentjoinclass");
const deleteClassRoute = require("./routes/deleteclassrouter");
const announcementRoute = require("./routes/anouncementroute");
const classAnnouncementRoute = require("./routes/classannoucementroute");
const materialRoute = require("./routes/materialRoute");
const sessionRoutes = require("./routes/sessions");
const newsRoutes = require("./routes/news");
const booksRoutes = require("./routes/books");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/class", classRoutes);
app.use("/api/classes", classesRoutes);
app.use("/api/updatepassword", updatePasswordRoute);
app.use("/api/updateprofile", updateProfileRoute);
app.use("/api/classname", classNameRoute);
app.use("/api/studentjoinclass", studentJoinClassRoute);
app.use("/api/deleteclass", deleteClassRoute);
// app.use("/api/announcement", announcementRoute); // Removed redundant
// app.use("/api/classannouncement", classAnnouncementRoute); // Removed redundant
app.use("/api/material", materialRoute);
app.use("/api/sessions", sessionRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/books", booksRoutes);
const roomRoutes = require("./routes/room");
const otpRoute = require("./routes/otp");
const presentationRoutes = require("./routes/presentation"); // NEW: Teaching Mode routesroom.js"));

app.use("/auth", authRoutes);

// Create or Join Class
app.use("/api/class", classRoutes);

// Fetch all classes for student / faculty
app.use("/api/classes", classesRoutes);

// Update Profile
app.use("/api/faculty", updateProfileRoute);

// Update Password
app.use("/api", updatePasswordRoute);

// Class-wise announcement (MUST be before general announcements)
app.use("/api/announcements/class", classAnnouncementRoute);

// General Announcements (aggregated, student specific, etc.)
app.use("/api/announcements", announcementRoute);

// Open Class / Start Meeting Room
app.use("/api/openclass", roomRoutes);

// Change class name ✔ FIXED missing slash
app.use("/api/change", require("./routes/classname.js"));

//it is used for material uploads
app.use("/api/material", require("./routes/materialRoute.js"));
app.use("/uploads", express.static("uploads"));
// Serve Video Call Static Files
app.use("/video", express.static(path.join(__dirname, "video-call")));

// it is use for the deletion of classess

app.use("/api/deleteclass", require("./routes/deleteclassrouter.js"));

// for reset password

app.use("/otp", require("./routes/otp"));

// Student join class routes
app.use("/api/student", require("./routes/studentjoinclass.js"));

// Session management (Video Call)
app.use("/api/sessions", require("./routes/sessions.js"));
app.use("/api/video-call", require("./routes/videoCallVerification.js")); // Face verification for video calls
app.use("/api/analytics", require("./routes/analytics")); // Analytics Dashboard Data

// ==========================================
// 🎨 WHITEBOARD SERVER (WBO) INTEGRATION
// ==========================================
// ==========================================
// 🎨 WHITEBOARD SERVER (WBO) INTEGRATION
// ==========================================
const WBO_PORT = 5001;
const WBO_DIR = path.join(__dirname, 'whiteboard_data');

// Ensure history directory exists
if (!require('fs').existsSync(WBO_DIR)){
    require('fs').mkdirSync(WBO_DIR);
}

const wboProcess = fork(path.join(__dirname, 'whiteboard/server/server.js'), [], {
    env: { 
        ...process.env, 
        PORT: WBO_PORT,
        HOST: '127.0.0.1', 
        WBO_HISTORY_DIR: WBO_DIR
    },
    stdio: 'inherit'
});

console.log(`🎨 WBO Whiteboard Process started on port ${WBO_PORT}`);

// Proxy /wbo to WBO server
// Proxy /wbo to WBO server
app.use('/wbo', createProxyMiddleware({
    target: `http://127.0.0.1:${WBO_PORT}`,
    changeOrigin: true,
    ws: true, 
    pathRewrite: (path, req) => {
        return path.replace('/wbo', ''); // Strip /wbo prefix
    },
    logLevel: 'debug',
    onError: (err, req, res) => {
        console.error('🔥 Proxy Error:', err);
        res.status(500).send('Proxy Error');
    }
}));

// Presentation Mode (Teaching Mode) - NEW
app.use("/api/sessions", require("./routes/presentation"));

// ==========================================
// COMPILER API LOGIC (Moved here + Imports)
// ==========================================
const { exec } = require('child_process');
const fs = require('fs').promises;
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_API_KEY');

// Temporary directory for code execution
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
(async () => {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create temp directory:', err);
    }
})();

// Rate limiting for Compiler
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 10;

function checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = rateLimit.get(ip) || [];
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= MAX_REQUESTS) {
        return false;
    }
    
    recentRequests.push(now);
    rateLimit.set(ip, recentRequests);
    return true;
}


// ==========================================
// COMPILER API ENDPOINTS
// ==========================================

// ===== COMPILE ENDPOINT =====
app.post('/api/compile', async (req, res) => {
    const clientIp = req.ip;
    
    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Please try again later.'
        });
    }
    
    const { language, code, input = '' } = req.body;
    
    if (!language || !code) {
        return res.status(400).json({
            success: false,
            error: 'Language and code are required'
        });
    }
    
    const startTime = Date.now();
    
    try {
        let result;
        
        switch (language.toLowerCase()) {
            case 'javascript':
                result = await executeJavaScript(code, input);
                break;
            case 'python':
                result = await executePython(code, input);
                break;
            case 'c':
                result = await executeC(code, input);
                break;
            case 'cpp':
            case 'c++':
                result = await executeCPP(code, input);
                break;
            case 'java':
                result = await executeJava(code, input);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported language'
                });
        }
        
        const executionTime = Date.now() - startTime;
        
        res.json({
            success: true,
            output: result.output,
            error: result.error,
            executionTime
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            executionTime: Date.now() - startTime
        });
    }
});

// ===== AI ANALYSIS ENDPOINT =====
app.post('/api/analyze-code', async (req, res) => {
    const clientIp = req.ip;
    
    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Please try again later.'
        });
    }
    
    const { code, language } = req.body;
    
    if (!code || !language) {
        return res.status(400).json({
            success: false,
            error: 'Code and language are required'
        });
    }
    
    // AI Analysis
     try {
         // Check if key is configured (simple check)
         if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('YOUR_API_KEY')) {
             throw new Error('Gemini API Key not configured in backend');
         }

        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        const prompt = `Analyze the following ${language} code and provide:
1. Time Complexity (Big O notation)
2. Space Complexity (Big O notation)
3. Detailed explanation of the algorithm
4. List of optimization suggestions
5. List of code quality improvements
6. Potential bugs or issues
7. An optimized version of the code (if applicable)

Code:
\`\`\`${language}
${code}
\`\`\`

Please respond in JSON format with the following structure:
{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "explanation": "detailed explanation",
  "optimizations": ["suggestion 1", "suggestion 2"],
  "suggestions": ["improvement 1", "improvement 2"],
  "bugs": ["bug 1", "bug 2"],
  "optimalCode": "optimized code here"
}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        let analysis;
        try {
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            } else {
                analysis = JSON.parse(text);
            }
        } catch (parseError) {
            analysis = {
                timeComplexity: "Analysis in progress",
                spaceComplexity: "Analysis in progress",
                explanation: text,
                optimizations: [],
                suggestions: [],
                bugs: [],
                optimalCode: code
            };
        }
        
        res.json({
            success: true,
            analysis
        });
        
    } catch (error) {
        console.error('Gemini API Error:', error);
        
        res.json({
            success: true,
            analysis: {
                timeComplexity: "AI Analysis Unavailable",
                spaceComplexity: "AI Analysis Unavailable",
                explanation: `AI analysis failed: ${error.message}.`,
                optimizations: ["Check server console for details"],
                suggestions: ["Ensure GEMINI_API_KEY is valid"],
                bugs: [],
                optimalCode: code
            }
        });
    }
});

// ===== CODE EXECUTION FUNCTIONS =====

async function executeJavaScript(code, input) {
    return new Promise((resolve) => {
        const logs = [];
        const errors = [];
        
        // Override console methods
        const originalLog = console.log;
        const originalError = console.error;
        
        console.log = (...args) => {
            logs.push(args.map(arg => String(arg)).join(' '));
            originalLog.apply(console, args);
        };
        
        console.error = (...args) => {
            errors.push(args.map(arg => String(arg)).join(' '));
            originalError.apply(console, args);
        };
        
        try {
            // Execute code with timeout
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const executor = new AsyncFunction(code);
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Execution timeout (5 seconds)')), 5000);
            });
            
            Promise.race([executor(), timeoutPromise])
                .then(() => {
                    console.log = originalLog;
                    console.error = originalError;
                    
                    resolve({
                        output: logs.join('\n'),
                        error: errors.length > 0 ? errors.join('\n') : null
                    });
                })
                .catch((error) => {
                    console.log = originalLog;
                    console.error = originalError;
                    
                    resolve({
                        output: logs.join('\n'),
                        error: error.message
                    });
                });
                
        } catch (error) {
            console.log = originalLog;
            console.error = originalError;
            
            resolve({
                output: logs.join('\n'),
                error: error.message
            });
        }
    });
}

async function executePython(code, input) {
    const filename = `temp_${Date.now()}.py`;
    const filepath = path.join(TEMP_DIR, filename);
    
    try {
        await fs.writeFile(filepath, code);
        
        return new Promise((resolve) => {
            const process = exec(
                `python "${filepath}"`,
                { timeout: 5000, maxBuffer: 1024 * 1024 },
                (error, stdout, stderr) => {
                    fs.unlink(filepath).catch(() => {});
                    
                    if (error && error.killed) {
                        resolve({
                            output: stdout,
                            error: 'Execution timeout (5 seconds)'
                        });
                    } else {
                        resolve({
                            output: stdout,
                            error: stderr || (error ? error.message : null)
                        });
                    }
                }
            );
            
            if (input) {
                process.stdin.write(input);
                process.stdin.end();
            }
        });
    } catch (error) {
        await fs.unlink(filepath).catch(() => {});
        return { output: '', error: error.message };
    }
}

async function executeC(code, input) {
    const filename = `temp_${Date.now()}`;
    const sourcePath = path.join(TEMP_DIR, `${filename}.c`);
    const execPath = path.join(TEMP_DIR, filename);
    
    try {
        await fs.writeFile(sourcePath, code);
        
        // Compile
        const compileResult = await new Promise((resolve) => {
            exec(
                `gcc "${sourcePath}" -o "${execPath}"`,
                { timeout: 5000 },
                (error, stdout, stderr) => {
                    resolve({ error, stdout, stderr });
                }
            );
        });
        
        if (compileResult.error) {
            await fs.unlink(sourcePath).catch(() => {});
            return {
                output: '',
                error: `Compilation error:\n${compileResult.stderr}`
            };
        }
        
        // Execute
        return new Promise((resolve) => {
            const process = exec(
                `"${execPath}"`,
                { timeout: 5000, maxBuffer: 1024 * 1024 },
                async (error, stdout, stderr) => {
                    await fs.unlink(sourcePath).catch(() => {});
                    await fs.unlink(execPath).catch(() => {});
                    
                    if (error && error.killed) {
                        resolve({
                            output: stdout,
                            error: 'Execution timeout (5 seconds)'
                        });
                    } else {
                        resolve({
                            output: stdout,
                            error: stderr || (error ? error.message : null)
                        });
                    }
                }
            );
            
            if (input) {
                process.stdin.write(input);
                process.stdin.end();
            }
        });
    } catch (error) {
        await fs.unlink(sourcePath).catch(() => {});
        await fs.unlink(execPath).catch(() => {});
        return { output: '', error: error.message };
    }
}

async function executeCPP(code, input) {
    const filename = `temp_${Date.now()}`;
    const sourcePath = path.join(TEMP_DIR, `${filename}.cpp`);
    const execPath = path.join(TEMP_DIR, filename);
    
    try {
        await fs.writeFile(sourcePath, code);
        
        // Compile with g++
        const compileResult = await new Promise((resolve) => {
            exec(
                `g++ "${sourcePath}" -o "${execPath}"`,
                { timeout: 5000 },
                (error, stdout, stderr) => {
                    resolve({ error, stdout, stderr });
                }
            );
        });
        
        if (compileResult.error) {
            await fs.unlink(sourcePath).catch(() => {});
            return {
                output: '',
                error: `Compilation error:\n${compileResult.stderr}`
            };
        }
        
        // Execute
        return new Promise((resolve) => {
            const process = exec(
                `"${execPath}"`,
                { timeout: 5000, maxBuffer: 1024 * 1024 },
                async (error, stdout, stderr) => {
                    await fs.unlink(sourcePath).catch(() => {});
                    await fs.unlink(execPath).catch(() => {});
                    
                    if (error && error.killed) {
                        resolve({
                            output: stdout,
                            error: 'Execution timeout (5 seconds)'
                        });
                    } else {
                        resolve({
                            output: stdout,
                            error: stderr || (error ? error.message : null)
                        });
                    }
                }
            );
            
            if (input) {
                process.stdin.write(input);
                process.stdin.end();
            }
        });
    } catch (error) {
        await fs.unlink(sourcePath).catch(() => {});
        await fs.unlink(execPath).catch(() => {});
        return { output: '', error: error.message };
    }
}

async function executeJava(code, input) {
    // Extract class name from code
    const classNameMatch = code.match(/public\s+class\s+(\w+)/);
    if (!classNameMatch) {
        return {
            output: '',
            error: 'No public class found. Java code must contain a public class.'
        };
    }
    
    const className = classNameMatch[1];
    const filename = `${className}.java`;
    const filepath = path.join(TEMP_DIR, filename);
    
    try {
        await fs.writeFile(filepath, code);
        
        // Compile
        const compileResult = await new Promise((resolve) => {
            exec(
                `javac "${filepath}"`,
                { cwd: TEMP_DIR, timeout: 5000 },
                (error, stdout, stderr) => {
                    resolve({ error, stdout, stderr });
                }
            );
        });
        
        if (compileResult.error) {
            await fs.unlink(filepath).catch(() => {});
            return {
                output: '',
                error: `Compilation error:\n${compileResult.stderr}`
            };
        }
        
        // Execute
        return new Promise((resolve) => {
            const process = exec(
                `java ${className}`,
                { cwd: TEMP_DIR, timeout: 5000, maxBuffer: 1024 * 1024 },
                async (error, stdout, stderr) => {
                    await fs.unlink(filepath).catch(() => {});
                    await fs.unlink(path.join(TEMP_DIR, `${className}.class`)).catch(() => {});
                    
                    if (error && error.killed) {
                        resolve({
                            output: stdout,
                            error: 'Execution timeout (5 seconds)'
                        });
                    } else {
                        resolve({
                            output: stdout,
                            error: stderr || (error ? error.message : null)
                        });
                    }
                }
            );
            
            if (input) {
                process.stdin.write(input);
                process.stdin.end();
            }
        });
    } catch (error) {
        await fs.unlink(filepath).catch(() => {});
        return { output: '', error: error.message };
    }
}

//-------------------------------------------------------------
// 🛑 Error Handling Middleware (for backend crashes)
//-------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

//-------------------------------------------------------------
// ❌ 404 Handler (Route not found)
//-------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

//-------------------------------------------------------------
// 🚀 Start Server
//-------------------------------------------------------------
const PORT = process.env.PORT || 5000;

//-------------------------------------------------------------
// 🔌 Socket.IO Setup for Real-Time Whiteboard & Collaboration
//-------------------------------------------------------------
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:4200", "http://localhost:5000", "http://127.0.0.1:4200", "http://127.0.0.1:5000"],
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Import Whiteboard Socket Handlers
const { setupWhiteboardHandlers } = require('./whiteboard_socket');

// Setup Whiteboard Handlers
setupWhiteboardHandlers(io);

// Main Signal Handler (for backward compatibility)
io.on('connection', (socket) => {
  // console.log(`🔌 Client connected: ${socket.id}`);

  // Join session room for signaling
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    // console.log(`📝 Client ${socket.id} joined session: ${sessionId}`);
  });
  
  // Broadcast whiteboard open event (legacy - now handled by whiteboard_socket.js)
  socket.on('whiteboard:opened', (data) => {
    console.log(`📋 Whiteboard opened by ${data.role} in session ${data.sessionId}`);
    // Broadcast to everyone else in the room
    socket.to(data.sessionId).emit('whiteboard:opened', data);
  });
  
  socket.on('disconnect', () => {
     // console.log('❌ Client disconnected');
  });
});


server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO whiteboard ready at /whiteboard`);
  console.log(`📹 Video Call App served at http://localhost:${PORT}/video/room.html`);
});

// });
