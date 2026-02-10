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
        chatType: 'group' // 'group' or 'direct'
    },

    init: async function() {
        try {
        console.log("🚀 Initializing Session Manager V3...");
        const params = new URLSearchParams(window.location.search);
        this.state.sessionId = params.get('session');
        this.state.role = params.get('role') || 'student';
        this.state.email = params.get('email');

        this.setupEventListeners();
        this.setupSocketListeners(); 



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
        
        // initOverlays();
        
        // Initialize Main Socket for signaling (Chat, Whiteboard, etc.)
        this.socket = io('/', { 
            query: { sessionId: this.state.sessionId, uid: this.state.facultyUid || 'guest' } 
        });

        this.setupEventListeners();
        this.setupSocketListeners(); 

        if(this.state.sessionId) {
            await this.fetchStatus();
            // Start Polling
            setInterval(() => this.fetchStatus(), 5000); 
            setInterval(() => this.tick(), 1000);
            
            // Start Chat Polling (every 2s)
            this.fetchMessages();
            setInterval(() => this.fetchMessages(), 2000);
            
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
        
        if(!this.socket) {
            alert("Chat unavailable: Connection lost");
            return;
        }

        const msgData = {
            sessionId: this.state.sessionId,
            sender: this.state.role === 'faculty' ? 'Faculty' : (this.state.email || 'Student'),
            text: text,
            type: this.state.chatType, 
            email: this.state.email,
            senderRole: this.state.role,
            senderId: this.socket.id // or UID if available
        };

        this.socket.emit('chat:sendMessage', msgData);
        input.value = '';
        
        // Optimistic update? No, we listen for our own emit back in server.js
        // But for direct messages, we receive it back. Group messages we receive back too.
    },
    
    fetchMessages: async function() {
        try {
            const res = await fetch(`/api/sessions/${this.state.sessionId}/messages`);
            if(!res.ok) return;

            const messages = await res.json();
            
            if(!Array.isArray(messages)) {
                // console.warn("Expected array of messages, got:", messages);
                return;
            }
            
            const feed = document.getElementById('activity-feed-list');
            if(!feed) return;
            
            feed.innerHTML = ''; 
            
            messages.forEach(msg => {
                this.addChatMessage(msg.senderName, msg.content, msg.senderEmail === this.state.email);
            });
        } catch(e) {
            // console.error("Poll messages error", e);
        }
    },
    
    addChatMessage: function(sender, text, isMe, type='group') {
        const feed = document.getElementById('activity-feed-list');
        if(!feed) return;
        
        const div = document.createElement('div');
        div.className = 'feed-item';
        
        let prefix = "";
        let styleClass = "";
        
        if (type === 'direct') {
            div.style.borderLeft = "4px solid #FFA500";
            div.style.backgroundColor = "#fff3e0"; // Light orange for DM
            prefix = `<span style="font-size:10px; color:#d84315; font-weight:bold; text-transform:uppercase;">[Private]</span> `;
            sender = isMe ? "You (to Faculty)" : sender;
        } else {
             // Group
             if(isMe || (sender === 'Faculty' && this.state.role === 'faculty')) {
                 div.style.background = '#e3f2fd'; // Light blue for me
                 div.style.alignSelf = 'flex-end'; 
                 if(!isMe) sender = "You (Faculty)";
                 else sender = "You";
             }
        }
        
        div.innerHTML = `${prefix}<strong style="color:#0F346C;">${sender}</strong>: <span style="color:#333;">${text}</span>`;
        feed.appendChild(div);
        
        // Auto scroll
        feed.scrollTop = feed.scrollHeight;
    },

    setupOverlayToggle: function(btnId, sectionId) {
        const btn = document.getElementById(btnId);
        if(!btn) {
            console.error(`❌ Button not found: ${btnId}`);
            return;
        }
        
        btn.addEventListener('click', async () => {
             console.log(`🔘 CLICKED: ${btnId} -> Toggling ${sectionId}`);
             console.log(`Current active: ${this.state.activeOverlay}`);
             
             if(this.state.activeOverlay === sectionId) {
                 this.closeAllOverlays();
             } else {
                 const panel = document.getElementById(sectionId);
                 
                 // Nuclear Option: Force Visibility via Inline Styles
                 this.closeAllOverlays();
                 panel.classList.remove('hidden');
                 panel.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483647 !important; top: 50%; left: 50%; transform: translate(-50%, -50%); position: fixed; width: 90vw; height: 85vh; background: white;';
                 
                 this.state.activeOverlay = sectionId;
                 console.log(`✅ Forced visibility on ${sectionId}`, panel);
                 
                 // Refresh contents specific
                 if(sectionId === 'whiteboard__section') {
                     this.initWhiteboard();
                     // Notify students if Faculty opens it
                     if(this.state.role === 'faculty' && this.socket) {
                         this.socket.emit('whiteboard:opened', {
                             sessionId: this.state.sessionId,
                             role: this.state.role
                         });
                         console.log('📡 Emitted whiteboard:opened');
                     }
                 }
                 if(sectionId === 'compiler_section') this.initCompiler();
                 if(sectionId === 'insights_section') this.initAnalytics();
             }
        });
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
                window.whiteboardInstance = new CollaborativeWhiteboard(
                    'whiteboard-canvas',
                    this.socket,
                    this.state.sessionId,
                    this.state.email,
                    this.state.role,
                    this.state.email // userName - can be enhanced with actual name
                );
                
                // Setup tool buttons
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
        if(this.socket) {
             this.socket.on('connect', () => {
                 console.log("✅ Main Socket Connected");
                 if(this.state.sessionId) {
                     // Join with Role for Direct Messaging routing
                     this.socket.emit('join-session', { 
                         sessionId: this.state.sessionId, 
                         role: this.state.role 
                     });
                     console.log(`📝 Joined socket room: ${this.state.sessionId}`);
                 }
             });

             // Chat Message Listener
             this.socket.on('chat:message', (msg) => {
                 const isMe = (msg.email === this.state.email && msg.senderRole === this.state.role);
                 // If undefined email (guest?), check sender text? Better to rely on isMe flag if socket.id matches?
                 // But we don't have socket.id easily here. 
                 // Simple check: 
                 
                 this.addChatMessage(msg.sender, msg.text, isMe, msg.type);
             });
             
             this.socket.on('whiteboard:opened', (data) => {
                 console.log("🎨 Whiteboard opened by faculty!", data);
                 if(this.state.role === 'student' && this.state.activeOverlay !== 'whiteboard__section') {
                     this.closeAllOverlays();
                     document.getElementById('whiteboard__section').classList.remove('hidden');
                     this.state.activeOverlay = 'whiteboard__section';
                     this.initWhiteboard();
                     
                     // Show a small toast notification properly
                     // (Optional)
                 }
             });
        }
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
});

// Debug Global Clicks
document.addEventListener('click', (e) => {
    // console.log('🖱️ Global Click:', e.target);
    if(e.target.closest('button')) {
        console.log('🔘 Button Click Detected:', e.target.closest('button').id);
    }
});
