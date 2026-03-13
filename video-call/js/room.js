// ===============================================
// 🚀 Orbit Video Call - Session Manager V3
// ===============================================

const SessionManager = {
    state: {
        sessionId: null,
        status: 'SCHEDULED',
        role: 'student',
        email: null,
        activeOverlay: null,
        facultyEmail: null,
        facultyUid: null,
        participants: [], // { email, uid, role, name }
        chartData: { labels: [], values: [] }, // Persistent Chart Data
        presentationMode: { isActive: false, type: null }, // Teaching Mode
        chatType: 'group', // 'group' or 'direct'
        renderedMsgIds: new Set(), // Track rendered message IDs to prevent duplicates
        chatLoaded: false // Flag to prevent re-loading initial messages
    },

    init: async function() {
        try {
        console.log("🚀 Initializing Session Manager V3...");
        const params = new URLSearchParams(window.location.search);
        this.state.sessionId = params.get('session');
        this.state.role = params.get('role') || 'student';
        this.state.email = params.get('email');

        // Visual confirmation that JS is running
        const toast = document.createElement('div');
        toast.innerText = "✅ Orbit System Ready";
        toast.style.position = 'fixed';
        toast.style.top = '10px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = '#4CAF50';
        toast.style.color = 'white';
        toast.style.padding = '8px 16px';
        toast.style.borderRadius = '20px';
        toast.style.zIndex = '9999';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        
        // Initialize Main Socket for signaling (Chat, Whiteboard, etc.)
        this.socket = io('/', { 
            query: { sessionId: this.state.sessionId, uid: this.state.facultyUid || 'guest' },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        // Setup listeners AFTER socket is created (fixes duplicate listener bug)
        this.setupEventListeners();
        this.setupSocketListeners(); 

        if(this.state.sessionId) {
            await this.fetchStatus();
            // Start Polling (status only, NOT chat)
            setInterval(() => this.fetchStatus(), 5000); 
            setInterval(() => this.tick(), 1000);
            
            // Load existing messages once from DB (then rely on socket for real-time)
            this.loadInitialMessages();
            
            // Hide Direct Message option for Faculty
            if(this.state.role === 'faculty') {
                const dmBtn = document.getElementById('chat-type-dm');
                if(dmBtn) dmBtn.style.display = 'none';
            }
        }
        } catch(e) {
            console.error("Session Init Error:", e);
            alert("Session Init Error: " + e.message);
        }
    },

    fetchStatus: async function() {
        try {
            const res = await fetch(`/api/sessions/${this.state.sessionId}/status`);
            const data = await res.json();
            
            if(data) {
                this.state.status = data.status || 'SCHEDULED';
                this.state.startTime = data.actualStartTime ? new Date(data.actualStartTime) : null;
                this.state.facultyEmail = data.facultyEmail;
                this.state.facultyUid = data.facultyUid;
                this.state.participants = data.participants || [];
                
                // Handle Presentation Mode changes
                const newPresentationMode = data.presentationMode || { isActive: false, type: null };
                if(newPresentationMode.isActive !== this.state.presentationMode.isActive) {
                    this.handlePresentationModeChange(newPresentationMode);
                }
                this.state.presentationMode = newPresentationMode;
                
                this.updateUI();
                
                // Expose to Global for RTC
                window.SESSION_DATA = {
                    facultyEmail: data.facultyEmail,
                    facultyUid: data.facultyUid,
                    classId: data.classId,
                    participants: data.participants,
                    className: data.className,
                    classCode: data.classCode,
                    facultyName: data.facultyName
                };
                
                // Update header with class info
                const headerTitle = document.querySelector('.header-info h2');
                if(headerTitle && data.className) {
                    headerTitle.textContent = `${data.className} ${data.classCode ? '(' + data.classCode + ')' : ''}`;
                }
                if(data.facultyName) {
                    const headerSubtitle = document.querySelector('.header-info p');
                    if(!headerSubtitle) {
                        const subtitle = document.createElement('p');
                        subtitle.style.cssText = 'margin:0; font-size:12px; color:#ccc;';
                        subtitle.textContent = `Faculty: ${data.facultyName}`;
                        document.querySelector('.header-info').appendChild(subtitle);
                    }
                }
            }
        } catch(e) { console.error("Poll Error", e); }
    },

    updateUI: function() {
        const badge = document.getElementById("session-status");
        if(this.state.status === 'LIVE') {
            badge.innerHTML = "● LIVE";
            badge.classList.add("live");
            this.toggleInteractiveFeatures(true);
            // Show the Stop Attendance button only for faculty
            if(this.state.role === 'faculty') {
                const stopBtn = document.getElementById('stop-attendance-btn');
                if(stopBtn) stopBtn.style.display = 'inline-flex';
            }
            // Attempt to join Agora if not already active
            if(window.joinRoomInit && (!window.isRTCActive || !window.isRTCActive())) {
                console.log("Session is LIVE -> Joining RTC...");
                window.joinRoomInit();
            }
        } else if (this.state.status === 'ENDED') {
            badge.innerHTML = "ENDED";
            badge.classList.remove("live");
            this.handleSessionEnded();
        } else {
             badge.innerHTML = "SCHEDULED";
             badge.classList.remove("live");
             if(this.state.role === 'faculty') {
                 badge.innerHTML = `<button onclick="SessionManager.startClass()" style="background:#FFA500; border:none; padding:4px 8px; border-radius:4px; font-weight:700; cursor:pointer;">START CLASS</button>`;
             }
        }
    },
    
    startClass: async function() {
        if(!confirm("Start Class?")) return;
        await fetch(`/api/sessions/${this.state.sessionId}/start`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ email: this.state.email })
        });
        alert("Class Started!");
        location.reload();
    },

    stopAttendance: async function() {
        // Create custom confirmation toast
        const toast = document.createElement('div');
        toast.innerHTML = `
            <div style="margin-bottom: 12px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b; font-size: 24px; margin-bottom: 8px;"></i>
                <h3 style="margin: 0 0 5px 0; font-size: 16px;">End Attendance Tracking?</h3>
                <p style="margin: 0; font-size: 13px; color: #ddd; line-height: 1.4;">
                    Students will no longer capture attendance matches. <br>The total class duration will be locked in.
                </p>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
                <button id="cancel-stop-btn" style="padding: 8px 16px; border: 1px solid #555; background: transparent; color: white; border-radius: 4px; cursor: pointer; transition: 0.2s;">
                    Cancel
                </button>
                <button id="confirm-stop-btn" style="padding: 8px 16px; border: none; background: #dc2626; color: white; border-radius: 4px; font-weight: 600; cursor: pointer; transition: 0.2s;">
                    Stop Tracking
                </button>
            </div>
        `;
        toast.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(15, 23, 42, 0.95); color: white; padding: 20px 25px;
            border-radius: 12px; z-index: 999999; font-family: 'Inter', sans-serif;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5); text-align: center; border: 1px solid #334155;
            min-width: 320px; backdrop-filter: blur(8px);
        `;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); z-index: 999998; backdrop-filter: blur(2px);
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(toast);

        // Handle Cancel
        document.getElementById('cancel-stop-btn').onclick = () => {
            document.body.removeChild(toast);
            document.body.removeChild(overlay);
        };

        // Handle Confirm
        document.getElementById('confirm-stop-btn').onclick = async () => {
            document.body.removeChild(toast);
            document.body.removeChild(overlay);
            
            try {
                const btn = document.getElementById('stop-attendance-btn');
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';

                await fetch(`/api/attendance/stop-tracking`, {
                    method: 'POST', 
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ sessionId: this.state.sessionId })
                });

                // Show Success Toast
                const successToast = document.createElement('div');
                successToast.innerHTML = `<i class="fa-solid fa-check-circle"></i> <b>Tracking Stopped</b><br><span style="font-size:12px;">The total class duration is now locked in.</span>`;
                successToast.style.cssText = `
                    position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
                    background: rgba(16, 185, 129, 0.95); color: white; padding: 12px 20px;
                    border-radius: 8px; z-index: 99999; font-family: 'Inter', sans-serif;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2); text-align: center;
                `;
                document.body.appendChild(successToast);
                setTimeout(() => {
                    successToast.style.opacity = '0';
                    successToast.style.transition = 'opacity 0.5s';
                    setTimeout(() => successToast.remove(), 500);
                }, 4000);

                btn.innerHTML = `<i class="fa-solid fa-user-check" style="color:var(--success);"></i>`; // Change icon to locked
            } catch(err) {
                console.error("Failed to stop attendance:", err);
                alert("Failed to stop attendance. See console.");
            }
        };
    },

    tick: function() {
        if(this.state.status !== 'LIVE' || !this.state.startTime) return;
        const diff = Math.floor((new Date() - this.state.startTime)/1000);
        const h = Math.floor(diff/3600).toString().padStart(2,'0');
        const m = Math.floor((diff%3600)/60).toString().padStart(2,'0');
        const s = (diff%60).toString().padStart(2,'0');
        document.getElementById("session-timer-display").innerHTML = `<i class="fa-regular fa-clock"></i> ${h}:${m}:${s}`;
        
        // Update Chart
        if(window.orbitChart && diff % 5 === 0) {
            updateChartData(diff);
        }
    },

    toggleInteractiveFeatures: function(enabled) {
         // FORCE ENABLE ALWAYS for debugging
         const btns = ['open_whiteboard_btn','open_compiler_btn'];
         btns.forEach(id => {
             const btn = document.getElementById(id);
             if(btn) {
                 btn.disabled = false;
                 btn.removeAttribute('disabled');
                 btn.style.opacity = '1';
                 btn.style.cursor = 'pointer';
                 // console.log(`🔓 Force enabled button: ${id}`);
             }
         });
    },

    handleSessionEnded: function() {
        if(window.leaveRoom) window.leaveRoom();
        document.body.innerHTML = `
        <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:white; color:#00004A;">
            <h1>❌ Session Ended</h1>
            <p>This class session has already ended.</p>
            <button onclick="window.close()" style="padding:10px 20px; background:#00004A; color:white; border:none; margin-top:20px; cursor:pointer;">Okay</button>
        </div>`;
    },

    setupEventListeners: function() {
        // Overlay Toggles
        this.setupOverlayToggle('open_whiteboard_btn', 'whiteboard__section');
        this.setupOverlayToggle('open_compiler_btn', 'compiler_section');
        this.setupOverlayToggle('open_chat_btn', 'chat_section');
        
        document.querySelectorAll('.close-overlay').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllOverlays());
        });

        // Chat Send Logic
        document.getElementById('send-msg-btn')?.addEventListener('click', () => this.sendChatMsg());
        document.getElementById('chat-msg-input')?.addEventListener('keydown', (e) => {
             if(e.key === 'Enter') this.sendChatMsg();
        });
        
        // Presentation Mode Controls
        document.getElementById('stop-presentation-btn')?.addEventListener('click', () => this.stopPresentation());

        // Chat Type Toggles
        const groupBtn = document.getElementById('chat-type-group');
        const dmBtn = document.getElementById('chat-type-dm');
        
        if(groupBtn && dmBtn) {
            groupBtn.addEventListener('click', () => {
                this.state.chatType = 'group';
                groupBtn.classList.add('active');
                dmBtn.classList.remove('active');
            });
            
            dmBtn.addEventListener('click', () => {
                this.state.chatType = 'direct';
                dmBtn.classList.add('active');
                groupBtn.classList.remove('active');
            });
        }
    },

    sendChatMsg: function() {
        const input = document.getElementById('chat-msg-input');
        if(!input) return;
        const text = input.value.trim();
        if(!text) return;
        
        if(!this.socket || !this.socket.connected) {
            alert("Chat unavailable: Connection lost. Trying to reconnect...");
            if(this.socket) this.socket.connect();
            return;
        }

        const msgData = {
            sessionId: this.state.sessionId,
            sender: this.state.role === 'faculty' ? 'Faculty' : (this.state.email || 'Student'),
            text: text,
            type: this.state.chatType, 
            email: this.state.email,
            senderRole: this.state.role,
            senderId: this.socket.id
        };

        this.socket.emit('chat:sendMessage', msgData);
        input.value = '';
    },
    
    // Load initial messages from DB (called once on init)
    loadInitialMessages: async function() {
        if(this.state.chatLoaded) return;
        try {
            const res = await fetch(`/api/sessions/${this.state.sessionId}/messages`);
            if(!res.ok) return;

            const messages = await res.json();
            if(!Array.isArray(messages)) return;
            
            messages.forEach(msg => {
                const msgId = msg._id ? msg._id.toString() : null;
                if(msgId && this.state.renderedMsgIds.has(msgId)) return; // Dedup
                if(msgId) this.state.renderedMsgIds.add(msgId);
                
                this.addChatMessage(
                    msg.senderName || msg.sender || 'Unknown', 
                    msg.content || msg.text, 
                    msg.senderEmail === this.state.email,
                    'group',
                    msg.timestamp
                );
            });
            this.state.chatLoaded = true;
        } catch(e) {
            console.error("Load messages error", e);
        }
    },
    
    addChatMessage: function(sender, text, isMe, type='group', timestamp) {
        const feed = document.getElementById('activity-feed-list');
        if(!feed) return;
        
        const div = document.createElement('div');
        div.className = 'feed-item';
        div.style.cssText = 'padding:8px 12px; margin:4px 0; border-radius:8px; transition:all 0.2s;';
        
        let prefix = "";
        let roleBadge = "";
        
        // Format timestamp
        let timeStr = '';
        if(timestamp) {
            const d = new Date(timestamp);
            timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        if (type === 'direct') {
            div.style.borderLeft = "4px solid #FFA500";
            div.style.backgroundColor = "#fff3e0";
            prefix = `<span style="font-size:10px; color:#d84315; font-weight:bold; text-transform:uppercase;">[Private]</span> `;
            sender = isMe ? "You (to Faculty)" : sender;
        } else {
             if(isMe || (sender === 'Faculty' && this.state.role === 'faculty')) {
                 div.style.background = '#e3f2fd';
                 div.style.borderLeft = '3px solid #1976d2';
                 if(!isMe) sender = "You (Faculty)";
                 else sender = "You";
             } else {
                 div.style.background = '#f5f5f5';
             }
             // Role badge
             if(sender === 'Faculty' || sender === 'You (Faculty)') {
                 roleBadge = `<span style="font-size:9px; background:#1976d2; color:white; padding:1px 5px; border-radius:3px; margin-left:4px;">Faculty</span>`;
             }
        }
        
        div.innerHTML = `${prefix}<strong style="color:#0F346C;">${sender}</strong>${roleBadge} <span style="font-size:10px; color:#999; margin-left:6px;">${timeStr}</span><br><span style="color:#333; font-size:13px;">${text}</span>`;
        feed.appendChild(div);
        
        // Auto scroll
        feed.scrollTop = feed.scrollHeight;
    },


    toggleOverlay: function(sectionId) {
        console.log(`🔘 Toggling overlay: ${sectionId}`);
        console.log(`Current active overlay: ${this.state.activeOverlay}`);
        
        if(this.state.activeOverlay === sectionId) {
            // Close if already open
            this.closeAllOverlays();
        } else {
            const panel = document.getElementById(sectionId);
            
            if(!panel) {
                console.error(`❌ Panel not found: ${sectionId}`);
                return;
            }
            
            // Close other overlays first
            this.closeAllOverlays();
            
            // Show this overlay by removing hidden class (CSS handles the rest)
            panel.classList.remove('hidden');
            
            this.state.activeOverlay = sectionId;
            console.log(`✅ Opened overlay: ${sectionId}`);
            
            // Initialize panel-specific functionality
            if(sectionId === 'whiteboard__section') {
                this.initWhiteboard();
                // Notify students if Faculty opens it
                if(this.state.role === 'faculty' && this.socket) {
                    this.socket.emit('whiteboard:opened', {
                        sessionId: this.state.sessionId,
                        role: this.state.role
                    });
                }
            }
            if(sectionId === 'compiler_section') {
                this.initCompiler();
                // Remind faculty to share screen for recording
                if(this.state.role === 'faculty') {
                    const toast = document.createElement('div');
                    toast.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <b>Screen Share Required</b><br><span style="font-size:12px;">To record your code, please click the 'Share Screen' button.</span>`;
                    toast.style.cssText = `
                        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
                        background: rgba(245, 158, 11, 0.95); color: white; padding: 12px 20px;
                        border-radius: 8px; z-index: 99999; font-family: 'Inter', sans-serif;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2); text-align: center;
                    `;
                    document.body.appendChild(toast);
                    setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transition = 'opacity 0.5s';
                        setTimeout(() => toast.remove(), 500);
                    }, 5000);
                }
            }
            if(sectionId === 'insights_section') this.initAnalytics();
            if(sectionId === 'chat_section') {
                 // Scroll to bottom
                 const feed = document.getElementById('activity-feed-list');
                 if(feed) feed.scrollTop = feed.scrollHeight;
            }
        }
    },

    setupOverlayToggle: function(btnId, sectionId) {
        const btn = document.getElementById(btnId);
        if(!btn) return;
        
        // Remove existing listeners? Not easy. 
        // Just add new one.
        btn.onclick = () => this.toggleOverlay(sectionId);
    },

    closeAllOverlays: function() {
        document.querySelectorAll('.overlay-panel').forEach(p => p.classList.add('hidden'));
        this.state.activeOverlay = null;
    },

    // ================= MODULES ================= //
    initWhiteboard: function() {
        try {
        console.log('🎨 Initializing Canvas Whiteboard...');
        console.log('📊 Current state:', {
            sessionId: this.state.sessionId,
            role: this.state.role,
            email: this.state.email,
            hasSocket: !!this.socket
        });
        
        // Force overlay panel dimensions BEFORE checking canvas
        const section = document.getElementById('whiteboard__section');
        if (section && !section.classList.contains('hidden')) {
            section.style.width = '90vw';
            section.style.height = '85vh';
            section.style.display = 'flex';
            section.style.flexDirection = 'column';
            console.log('🔧 Forced overlay panel dimensions');
        }
        
        // Check if canvas element exists
        const canvas = document.getElementById('whiteboard-canvas');
        if (!canvas) {
            console.error('❌ Canvas element not found in DOM!');
            return;
        }
        console.log('✅ Canvas element found');
        
        // Check if section is visible
        if (section) {
            console.log('📋 Whiteboard section state:', {
                hasHiddenClass: section.classList.contains('hidden'),
                display: window.getComputedStyle(section).display,
                zIndex: window.getComputedStyle(section).zIndex,
                visibility: window.getComputedStyle(section).visibility,
                width: window.getComputedStyle(section).width,
                height: window.getComputedStyle(section).height
            });
        }
        
        // Destroy existing whiteboard if any
        if (window.whiteboardInstance) {
            console.log('🗑️ Destroying existing whiteboard instance');
            window.whiteboardInstance.destroy();
        }
        
        // Create new collaborative whiteboard instance
        if (this.socket && this.state.sessionId) {
            try {
                window.whiteboardInstance = new EnhancedWhiteboard(
                    'whiteboard-canvas',
                    this.socket,
                    this.state.sessionId,
                    this.state.email,
                    this.state.role,
                    this.state.email // userName - can be enhanced with actual name
                );
                
                // Initialize Glassmorphic UI
                window.wbUI = new WhiteboardUI(window.whiteboardInstance);

                // Setup tool buttons (Legacy or New)
                // The new WhiteboardUI handles its own listeners, but we keep this for backward compatibility 
                // if legacy DOM elements exist.
                document.querySelectorAll('.wb-tool-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const tool = e.currentTarget.getAttribute('data-tool');
                        if (tool) {
                            document.querySelectorAll('.wb-tool-btn').forEach(b => b.classList.remove('active'));
                            e.currentTarget.classList.add('active');
                            window.whiteboardInstance.setTool(tool);
                        }
                    });
                });
                
                // Color picker
                document.getElementById('wb-color-picker')?.addEventListener('change', (e) => {
                    window.whiteboardInstance.setColor(e.target.value);
                });
                
                // Line width
                document.getElementById('wb-line-width')?.addEventListener('change', (e) => {
                    window.whiteboardInstance.setLineWidth(parseInt(e.target.value));
                });
                
                // Clear button
                document.getElementById('wb-clear-btn')?.addEventListener('click', () => {
                    if (confirm('Clear the entire whiteboard? This cannot be undone.')) {
                        window.whiteboardInstance.clearCanvasAndNotify();
                    }
                });
                
                console.log('✅ Canvas Whiteboard initialized successfully');
            } catch (error) {
                console.error('❌ Error initializing whiteboard:', error);
            }
        } else {
            console.error('❌ Cannot initialize whiteboard:', {
                hasSocket: !!this.socket,
                hasSessionId: !!this.state.sessionId
            });
        }

    } catch(e) {
        console.error("❌ Critical Whiteboard Init Error:", e);
        alert("Whiteboard Init Error: " + e.message);
    }
    },

    setupSocketListeners: function() {
        if(!this.socket) {
            console.warn('⚠️ Socket not initialized, cannot setup listeners');
            return;
        }
        
        this.socket.on('connect', () => {
            console.log("✅ Main Socket Connected");
            if(this.state.sessionId) {
                this.socket.emit('join-session', { 
                    sessionId: this.state.sessionId, 
                    role: this.state.role 
                });
                console.log(`📝 Joined socket room: ${this.state.sessionId}`);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.warn(`⚠️ Socket disconnected: ${reason}`);
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
            // Re-join room after reconnection
            if(this.state.sessionId) {
                this.socket.emit('join-session', { 
                    sessionId: this.state.sessionId, 
                    role: this.state.role 
                });
            }
        });

        // Chat Message Listener (with deduplication)
        this.socket.on('chat:message', (msg) => {
            // Deduplication: skip if already rendered
            if(msg._id && this.state.renderedMsgIds.has(msg._id)) return;
            if(msg._id) this.state.renderedMsgIds.add(msg._id);
            
            const isMe = (msg.email === this.state.email && msg.senderRole === this.state.role);
            this.addChatMessage(msg.sender, msg.text, isMe, msg.type, msg.timestamp);
        });
        
        // Whiteboard opened listener (unchanged)
        this.socket.on('whiteboard:opened', (data) => {
            console.log("🎨 Whiteboard opened by faculty!", data);
            if(this.state.role === 'student' && this.state.activeOverlay !== 'whiteboard__section') {
                this.closeAllOverlays();
                document.getElementById('whiteboard__section').classList.remove('hidden');
                this.state.activeOverlay = 'whiteboard__section';
                this.initWhiteboard();
            }
        });
    },
    
    initCompiler: function() {
        if(!window.editor && document.getElementById('codeplace')) {
             window.editor = CodeMirror.fromTextArea(document.getElementById('codeplace'), {
                 mode: 'python', theme: 'dracula', lineNumbers: true
             });
        }
    },
    
    initAnalytics: function() {
        // Update Participant Count
        const count = this.state.participants.length;
        const countDisplay = document.getElementById("participant-count-header");
        if(countDisplay) countDisplay.innerText = count;

        // Populate list
        const list = document.getElementById("member__list");
        if(list) {
            list.innerHTML = '';
            // active participants first
            this.state.participants.forEach(p => {
                 const d = document.createElement("div");
                 d.style.padding = "8px";
                 d.style.borderBottom = "1px solid #eee";
                 d.innerHTML = `<strong>${p.name || p.email}</strong> <span style="font-size:12px;color:#888">(${p.role})</span>`;
                 list.appendChild(d);
            });
        }
        
        if(!window.orbitChart && document.getElementById('activity-chart')) {
             const ctx = document.getElementById('activity-chart').getContext('2d');
             window.orbitChart = new Chart(ctx, {
                 type: 'line',
                 data: { 
                    labels: this.state.chartData.labels, 
                    datasets: [{ 
                        label: 'Active', 
                        data: this.state.chartData.values, 
                        borderColor: '#FFA500', 
                        fill:true 
                    }] 
                 }
             });
        }
    },
    
    // ================= PRESENTATION MODE ================= //
    handlePresentationModeChange: function(newMode) {
        console.log('📊 Presentation mode changed:', newMode);
        console.log(`👤 Current role: ${this.state.role}`);
        console.log(`🔄 Previous state:`, this.state.presentationMode);
        
        if(newMode.isActive) {
            console.log(`🎬 ENTERING presentation mode (${newMode.type})`);
            this.enterPresentationMode(newMode.type);
        } else {
            console.log(`🎬 EXITING presentation mode`);
            this.exitPresentationMode();
        }
    },
    
    enterPresentationMode: function(type) {
        console.log(`🎬 Entering presentation mode: ${type}`);
        
        // Show presentation container
        const container = document.getElementById('presentation-mode-container');
        if(container) container.classList.add('active');
        
        // Hide normal grid
        document.body.classList.add('in-presentation');
        
        // Update indicator
        const indicator = document.getElementById('presentation-indicator');
        const label = document.getElementById('presentation-type-label');
        if(this.state.role === 'student') {
            if(indicator) indicator.style.display = 'flex';
            if(label) label.textContent = `Faculty is presenting: ${type}`;
        }
        
        // Show controls for faculty
        if(this.state.role === 'faculty') {
            const controls = document.getElementById('presentation-controls');
            if(controls) controls.classList.add('active');
        }
        
        // Disable whiteboard/compiler buttons for students
        if(this.state.role === 'student') {
            document.getElementById('open_whiteboard_btn')?.setAttribute('disabled', 'true');
            document.getElementById('open_compiler_btn')?.setAttribute('disabled', 'true');
        }
    },
    
    exitPresentationMode: function() {
        console.log('🎬 Exiting presentation mode');
        
        // Hide presentation container
        const container = document.getElementById('presentation-mode-container');
        if(container) container.classList.remove('active');
        
        // Show normal grid
        document.body.classList.remove('in-presentation');
        
        // Hide indicator
        const indicator = document.getElementById('presentation-indicator');
        if(indicator) indicator.style.display = 'none';
        
        // Hide controls
        const controls = document.getElementById('presentation-controls');
        if(controls) controls.classList.remove('active');
        
        // Re-enable buttons for students
        if(this.state.role === 'student' && this.state.status === 'LIVE') {
            document.getElementById('open_whiteboard_btn')?.removeAttribute('disabled');
            document.getElementById('open_compiler_btn')?.removeAttribute('disabled');
        }
    },
    
    async stopPresentation() {
        if(this.state.role !== 'faculty') return;
        
        try {
            // Stop screen share first
            if(window.stopScreenShare) {
                await window.stopScreenShare();
            }
            
            const res = await fetch(`/api/sessions/${this.state.sessionId}/presentation/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            if(res.ok) {
                console.log('✅ Presentation stopped');
                // State will update via polling
            } else {
                console.error('❌ Failed to stop presentation');
            }
        } catch(e) {
            console.error('Stop presentation error:', e);
        }
    }
};

// Expose startPresentation for whiteboard/compiler buttons
window.startPresentation = async function(type) {
    console.log(`🚀 startPresentation called with type: ${type}`);
    console.log(`📋 Current role: ${SessionManager.state.role}`);
    
    if(SessionManager.state.role !== 'faculty') {
        console.warn('⚠️ Not faculty, skipping presentation start');
        return;
    }
    
    try {
        const url = `/api/sessions/${SessionManager.state.sessionId}/presentation/start`;
        console.log(`🌐 Fetching: ${url}`);
        
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
            credentials: 'include'
        });
        
        console.log(`📡 Response status: ${res.status}`);
        
        if(res.ok) {
            const data = await res.json();
            console.log(`✅ ${type} presentation started`, data);
        } else {
            const error = await res.json();
            console.error('❌ Failed to start presentation:', error);
            alert(error.error || 'Failed to start presentation');
        }
    } catch(e) {
        console.error('💥 Start presentation error:', e);
    }
};

function updateChartData(time) {
    // Always store data in state
    const label = Math.floor(time/60) + 'm';
    if(SessionManager.state.chartData.labels.slice(-1)[0] !== label) {
        SessionManager.state.chartData.labels.push(label);
        // Mock data: vary slightly
        const val = SessionManager.state.participants.length; // Use real participant count
        SessionManager.state.chartData.values.push(val);
        
        // Limit history
        if(SessionManager.state.chartData.labels.length > 8) {
            SessionManager.state.chartData.labels.shift();
            SessionManager.state.chartData.values.shift();
        }
    }

    // Update Chart if visible
    if(window.orbitChart) {
        window.orbitChart.data.labels = SessionManager.state.chartData.labels;
        window.orbitChart.data.datasets[0].data = SessionManager.state.chartData.values;
        window.orbitChart.update();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    SessionManager.init();
    // Expose for inline onclick handlers
    window.SessionManager = SessionManager;
});

// Debug Global Clicks
document.addEventListener('click', (e) => {
    // console.log('🖱️ Global Click:', e.target);
    if(e.target.closest('button')) {
        console.log('🔘 Button Click Detected:', e.target.closest('button').id);
    }
});
