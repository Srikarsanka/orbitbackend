// ===============================================
// ORBIT Live Class - RTC V3 (Placement Logic)
// ===============================================

let APP_ID = null;
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("session") || urlParams.get("room");
const userRole = urlParams.get("role") || "student"; 
const userEmail = urlParams.get("email") || "";
const userName = urlParams.get("name") || "User";
const deviceId = urlParams.get("deviceId") || localStorage.getItem("deviceId") || generateDeviceId();

localStorage.setItem("deviceId", deviceId);

let uid = null; // Will be set by validate
let token = null;
let screenToken = null; // New global for screen share
let client;
let localTracks = []; 
let remoteUsers = {};
let sessionActive = false;
let screenTrack = null;
let isJoining = false; // Prevent duplicate joins
let hasJoined = false; // Track if already joined

// ===============================================
// Helpers
// ===============================================
function generateDeviceId() {
  return 'device_' + Math.random().toString(36).substr(2, 9);
}

// ===============================================
// Init
// ===============================================
let joinRoomInit = async () => {
    console.log('🚀 joinRoomInit called');
    
    if (isJoining || hasJoined || sessionActive) {
        console.log('⚠️ Already joining or joined, skipping duplicate call');
        return;
    }
    
    isJoining = true;
    
    try {
        await validateSession();
        
        // FACE VERIFICATION FOR STUDENTS
        // Faculty bypass verification, students must verify every join
        if (userRole === 'student') {
            console.log('🔐 Student detected - Face verification required');
            
            // Show verification modal and wait for completion
            return new Promise((resolve, reject) => {
                // Override the proceedToJoinCall function to continue after verification
                window.proceedToJoinCall = async () => {
                    console.log('✅ Face verification passed - Continuing join flow');
                    try {
                        await continueJoinFlow();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                
                // Show verification modal
                if (window.FaceVerification) {
                    window.FaceVerification.show();
                } else {
                    console.error('❌ Face verification module not loaded');
                    reject(new Error('Face verification unavailable'));
                }
            });
        } else {
            // Faculty - bypass verification
            console.log('✅ Faculty detected - Bypassing face verification');
            
            // Explicitly hide modal in case it was triggered or visible by default
            if (window.FaceVerification && typeof window.FaceVerification.hide === 'function') {
                window.FaceVerification.hide();
            } else {
                const modal = document.getElementById('faceVerificationModal');
                if(modal) modal.style.display = 'none';
            }

            await continueJoinFlow();
        }
        
    } catch (error) {
        console.error("Init Error", error);
        hasJoined = false; // Reset on error
        
        if(error.message && error.message.includes("scheduled")) {
            console.log("Session scheduled. Waiting for start...");
            // Do not alert. Room.js will handle UI "Starting Soon".
            // And Room.js will trigger joinRoomInit when LIVE.
        } else {

            console.error("🚨 JOIN ERROR DETAILS:", error);
            // safe stringify for error object
            let errorDetails = error.message || "Unknown error";
            if(error.code) errorDetails += ` (Code: ${error.code})`;
            
            // Checks for common Agora errors
            if (error.code === 'INVALID_APP_ID') errorDetails += " - Check App ID in Render config";
            if (error.code === 'INVALID_TOKEN') errorDetails += " - Token invalid or expired";
            if (error.code === 'NOT_AUTHORIZED') errorDetails += " - Certificate issue?";

            // Create a copyable error display
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '20px';
            errorDiv.style.left = '50%';
            errorDiv.style.transform = 'translateX(-50%)';
            errorDiv.style.background = '#ffebee';
            errorDiv.style.color = '#c62828';
            errorDiv.style.padding = '15px';
            errorDiv.style.borderRadius = '8px';
            errorDiv.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            errorDiv.style.zIndex = '9999';
            errorDiv.style.maxWidth = '80%';
            errorDiv.style.fontFamily = 'monospace';
            errorDiv.style.whiteSpace = 'pre-wrap';
            errorDiv.innerHTML = `<strong>⚠️ Failed to join call:</strong><br>${errorDetails}<br><br><small>Check console (F12) for full details.</small>`;
            
            // Allow closing
            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '5px';
            closeBtn.style.right = '5px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = () => errorDiv.remove();
            errorDiv.appendChild(closeBtn);

            document.body.appendChild(errorDiv);
            
            console.error("🚨 SHOWN ERROR IN UI:", errorDetails);
        }
    } finally {
        isJoining = false;
    }
};

// Continue join flow after verification (or for faculty)
async function continueJoinFlow() {
    // CRITICAL: Fetch SESSION_DATA BEFORE joining to ensure it's available for remote users
    console.log("🔄 Fetching SESSION_DATA before joining...");
    try {
        const res = await fetch(`/api/sessions/${sessionId}/status`);
        const data = await res.json();
        window.SESSION_DATA = { 
            facultyEmail: data.facultyEmail, 
            facultyUid: data.facultyUid,
            participants: data.participants 
        };
        console.log("✅ SESSION_DATA pre-loaded:", window.SESSION_DATA);
    } catch(e) {
        console.error("❌ Failed to pre-load SESSION_DATA:", e);
    }
    
    if (!client) {
        client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        client.on("user-published", handleUserPublished);
        client.on("user-left", handleUserLeft);
        client.on("user-mute-video", handleRemoteMuteVideo);
    }

    await client.join(APP_ID, sessionId, token, uid);
    console.log("✅ Successfully joined Agora channel");
    hasJoined = true;
    
    await joinStream();
    
    sessionActive = true;
    setupMediaControls();
}

async function validateSession() {
    const res = await fetch(`/api/sessions/${sessionId}/validate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email: userEmail, deviceId, role: userRole })
    });
    console.log(`📡 Validate Response Status: ${res.status}`);
    const data = await res.json();
    console.log(`📦 Validate Data:`, data);
    
    // Handle redirect to active session
    if (data.redirect && data.newSessionId) {
        console.log(`🔄 Redirecting to active session: ${data.newSessionId}`);
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('session', data.newSessionId);
        window.location.href = currentUrl.toString();
        return; // Stop execution, page will reload
    }
    
    if(!data.isValid) {
        const errorMsg = data.reason || data.error || data.message || "Unknown validation failure";
        console.error("❌ Validation Failed:", errorMsg, data);
        throw new Error(errorMsg);
    }
    token = data.token;
    screenToken = data.screenToken; // Store screen token
    APP_ID = data.appId;
    if(data.uid) {
        uid = data.uid;
        localStorage.setItem('orbit_uid', uid);
    }
}

let joinStream = async () => {
    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks({}, { encoderConfig: '1080p_1' });
    
    // Determine where to place LOCAL video
    // If I am faculty, I go to Primary. Else Grid.
    let targetId = "student-grid-container";
    if(userRole === 'faculty') targetId = "primary-video-container";

    const container = createVideoContainer(uid, userName, true);
    addToContainer(targetId, container);
    
    localTracks[1].play(`user-${uid}`);
    await client.publish(localTracks);
    console.log("🎤 Local Audio & Video Published");
    
    // Check if mic is working (volume check)
    setInterval(() => {
        if(localTracks[0]) {
            const level = localTracks[0].getVolumeLevel();
            if(level > 0.1) {
                // console.log(`🎤 Mic Input Detected: ${level}`); 
                // Uncomment to debug if mic is actually picking up sound
            }
        }
    }, 2000);
    
    
    if(userRole === 'student') enforceCameraAlwaysOn(localTracks[1]);

    // Add a dummy spectator card for visual interest
    addDummySpectator();
};

function addDummySpectator() {
    const grid = document.getElementById("student-grid-container");
    if (!grid) return;

    // Create a dummy container
    const div = document.createElement("div");
    div.className = "video__containers spectator-card";
    div.innerHTML = `
        <div class="spectator-bg">
            <div class="spectator-icon">👀</div>
            <div class="spectator-text">Spectating</div>
            <div class="spectator-sub">Class Recording On</div>
        </div>
    `;
    
    // Append to grid (student-grid-container matches the ID in HTML/layout)
    // We check if "streams_container" exists (from previous logic) or direct append
    const streamsContainer = document.getElementById("streams_container");
    if(streamsContainer) {
        streamsContainer.appendChild(div);
    } else {
        grid.appendChild(div);
    }
}

function addToContainer(targetId, element) {
    const parent = document.getElementById(targetId);
    if(parent) {
        console.log(`📍 Adding element to: ${targetId}`);
        
        // If Primary, clear existing placeholder
        if(targetId === "primary-video-container") {
             const placeholder = parent.querySelector('.empty-state-faculty');
             if(placeholder) placeholder.style.display = 'none';
        }
        
        // If Presentation Area, append directly
        if(targetId === "presentation-content-area") {
            parent.innerHTML = ''; // Clear any existing content
            parent.appendChild(element);
            console.log(`✅ Added to presentation area`);
            return;
        }
        
        // If Grid, ensure grid wrapper (Streams Container)
        if(targetId === "student-grid-container") {
            const streamsContainer = document.getElementById("streams_container");
            if(streamsContainer) {
                streamsContainer.appendChild(element);
            } else {
                parent.appendChild(element);
            }
        } else {
            parent.appendChild(element); // Direct append to Primary
        }
    } else {
        console.error(`❌ Container not found: ${targetId}`);
    }
}

function createVideoContainer(uid, name, isLocal=false) {
    const div = document.createElement("div");
    div.className = "video__containers";
    div.id = `user-container-${uid}`;
    
    // Labels
    let roleLabel = ""; // Logic to detect role needed? 
    // We can infer role from Name or check SessionData
    // Or simpler: Checks if isFaculty
    
    let isFaculty = false;
    if(window.SESSION_DATA && window.SESSION_DATA.facultyEmail) {
         // Need email of this UID.
         const p = window.SESSION_DATA.participants.find(x => x.uid == uid);
         if(p && p.email === window.SESSION_DATA.facultyEmail) isFaculty = true;
    }
    // Fallback if local user is faculty
    if(isLocal && userRole === 'faculty') isFaculty = true;

    const label = isFaculty ? '<span style="background:#FFA500; color:black; padding:2px 4px; border-radius:2px; font-weight:bold; font-size:10px; margin-right:4px;">FACULTY</span>' 
                            : '<span style="background:#eee; color:#333; padding:2px 4px; border-radius:2px; font-size:10px; margin-right:4px;">STUDENT</span>';

    const youLabel = isLocal || (localStorage.getItem('orbit_uid') == uid) ? '(You)' : '';

    div.innerHTML = `
        <div class="video-box">
            <video id="user-${uid}" autoplay playsinline class="video-player"></video>
        </div>
        <div class="video-placeholder" id="placeholder-${uid}" style="display:none;">
            <div style="width:50px; height:50px; background:#5b5fc7; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:bold;">
                ${name.charAt(0).toUpperCase()}
            </div>
            <div style="margin-top:8px; font-size:12px;">${isFaculty ? 'Faculty Stopped Video' : 'Video Off'}</div>
        </div>
        <div class="name-tag" style="display:flex; align-items:center;">
            ${label}
            <span>${name} ${youLabel}</span>
        </div>
    `;
    return div;
}

// ===============================================
// Media Controls
// ===============================================
function setupMediaControls() {
    document.getElementById('mic-btn')?.addEventListener('click', toggleMic);
    document.getElementById('camera-btn')?.addEventListener('click', toggleCamera);
    document.getElementById('screen-btn')?.addEventListener('click', toggleScreen);
    document.getElementById('leave-btn')?.addEventListener('click', leaveRoom);

    // Hide Screen Share button for students
    if(userRole !== 'faculty') {
        const screenBtn = document.getElementById('screen-btn');
        if(screenBtn) screenBtn.style.display = 'none';
    }
}

let screenClient = null;
let localScreenTracks = null;
let sharingScreen = false;

async function toggleScreen(e) {
    let screenBtn = e.currentTarget;

    if(!sharingScreen) {
        try {
            // Create Screen Track
            localScreenTracks = await AgoraRTC.createScreenVideoTrack({
                encoderConfig: "1080p_1",
                optimizationMode: "detail" // Optimized for text/content
            });

            // Create Screen Client (Separate Client)
            screenClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            
            // Screen UID convention: FacultyUID + 1,000,000
            let screenUid = Number(uid) + 1000000;
            
            // Use screenToken if available (Faculty), otherwise fallback to main token (likely to fail if UID bound)
            // But we specifically generated screenToken for this purpose.
            let tokenToUse = screenToken || token;

            await screenClient.join(APP_ID, sessionId, tokenToUse, screenUid);
            await screenClient.publish(localScreenTracks);

            sharingScreen = true;
            screenBtn.classList.add('active');

            // Handle browser-native "Stop Sharing" button
            localScreenTracks.on("track-ended", () => {
                stopScreenShare();
                screenBtn.classList.remove('active');
            });

        } catch(err) {
            console.error("Error starting screen share:", err);
            sharingScreen = false;
        }
    } else {
        stopScreenShare();
        screenBtn.classList.remove('active');
    }
}

async function stopScreenShare() {
    if(localScreenTracks) {
        localScreenTracks.close();
        localScreenTracks = null;
    }
    if(screenClient) {
        await screenClient.leave();
        screenClient = null;
    }
    sharingScreen = false;
    console.log("Stopped screen share");
}

// ===============================================
// TEACHING MODE: Start Screen Share for Presentation
// ===============================================
window.startScreenShareForPresentation = async function() {
    if(sharingScreen) {
        console.log("⚠️ Already sharing screen");
        return;
    }
    
    try {
        console.log("🎬 Starting screen share for presentation...");
        
        // Create Screen Track with auto-select current tab
        localScreenTracks = await AgoraRTC.createScreenVideoTrack({
            encoderConfig: "1080p_1",
            optimizationMode: "detail",
            // Auto-select current tab (no prompt!)
            screenSourceType: 'screen',
            displaySurface: 'browser' // This hints to select browser tab
        }, false); // false = don't include audio

        // Create Screen Client (Separate Client)
        screenClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        
        // Screen UID convention: FacultyUID + 1,000,000
        let screenUid = Number(uid) + 1000000;
        
        // Use screenToken if available
        let tokenToUse = screenToken || token;

        await screenClient.join(APP_ID, sessionId, tokenToUse, screenUid);
        await screenClient.publish(localScreenTracks);

        sharingScreen = true;
        console.log("✅ Screen share started for presentation");

        // Handle browser-native "Stop Sharing" button
        localScreenTracks.on("track-ended", async () => {
            console.log("🛑 User stopped screen share");
            await stopScreenShare();
            
            // Stop presentation mode
            if(SessionManager && SessionManager.stopPresentation) {
                await SessionManager.stopPresentation();
            }
        });

    } catch(err) {
        console.error("❌ Error starting screen share:", err);
        sharingScreen = false;
        
        // If user cancelled, show helpful message
        if(err.code === 'PERMISSION_DENIED' || err.name === 'NotAllowedError') {
            alert('Screen sharing was cancelled. Please click Whiteboard again and select "Current Tab" to share.');
        }
        throw err;
    }
};

async function toggleMic(e) {
    if(!localTracks[0]) return;
    const btn = e.currentTarget;
    const muted = localTracks[0].muted;
    await localTracks[0].setMuted(!muted);
    
    const icon = btn.querySelector('i');
    if(!muted) { // Now Muted
        btn.classList.add('danger');
        icon.className = 'fa-solid fa-microphone-slash';
    } else {
        btn.classList.remove('danger');
        icon.className = 'fa-solid fa-microphone';
    }
}

async function toggleCamera(e) {
    if(!localTracks[1]) return;
    
    // Students cannot turn off camera
    if(userRole === 'student') {
        alert("Students must keep camera ON during class.");
        return;
    }
    
    const btn = e.currentTarget;
    const muted = localTracks[1].muted;
    await localTracks[1].setMuted(!muted);
    
    const icon = btn.querySelector('i');
    if(!muted) { // Now Muted
         btn.classList.add('danger');
         icon.className = 'fa-solid fa-video-slash';
         updatePlaceholder(uid, true);
    } else {
         btn.classList.remove('danger');
         icon.className = 'fa-solid fa-video';
         updatePlaceholder(uid, false);
    }
}

function updatePlaceholder(uid, muted) {
    const c = document.getElementById(`user-container-${uid}`);
    if(c) {
        c.querySelector('.video-box').style.display = muted ? 'none' : 'block';
        c.querySelector('.video-placeholder').style.display = muted ? 'flex' : 'none';
    }
}

async function toggleScreenShare(e) {
    if(userRole !== 'faculty') return alert("Only faculty can share screen.");
    
    const btn = e.currentTarget;

    if(screenTrack) {
        // STOP SHARING
        await client.unpublish(screenTrack);
        screenTrack.close();
        screenTrack = null;
        btn.classList.remove('active');
        
        // Restore Camera (if we had one)
        if(localTracks[1]) {
            await client.publish(localTracks[1]);
        }
    } else {
        // START SHARING
        // 1. Unpublish current video track (Camera)
        const videoTrack = client.localTracks.find(t => t.trackMediaType === 'video');
        if(videoTrack) {
            await client.unpublish(videoTrack);
        }

        try {
            screenTrack = await AgoraRTC.createScreenVideoTrack();
            await client.publish(screenTrack);
            btn.classList.add('active');
            
            // Native Stop Listener
            screenTrack.on('track-ended', () => {
                if(screenTrack) toggleScreenShare({ currentTarget: btn });
            });
        } catch(err) {
            console.error("Screen Share Failed", err);
            // Restore camera if failed
            if(localTracks[1] && !client.localTracks.find(t => t.trackMediaType === 'video')) {
                await client.publish(localTracks[1]);
            }
        }
    }
}

// ===============================================
// Remote Logic
// ===============================================
let handleUserPublished = async (user, mediaType) => {
    console.log(`📹 User published: UID=${user.uid} (type: ${typeof user.uid}), MediaType=${mediaType}`);
    
    await client.subscribe(user, mediaType);
    
    if(mediaType === 'video') {
         // Detect Role
        let isFaculty = false;
        let isScreenShare = false;
        let pName = "User " + user.uid;
        let facultyUid = window.SESSION_DATA ? window.SESSION_DATA.facultyUid : null;

        // Check if this is a screen share (Faculty UID + 1000000)
        // Convert both to numbers for safe comparison
        if(facultyUid && Number(user.uid) === Number(facultyUid) + 1000000) {
            isScreenShare = true;
            pName = "Faculty Screen";
            console.log("🖥️ SCREEN SHARE DETECTED from UID:", user.uid);
        }

        // ALWAYS fetch fresh SESSION_DATA to get latest participants
        // ... (Only fetch if not already verified or periodically? keeping existing logic for safety)
        if(!window.SESSION_DATA || !window.SESSION_DATA.facultyUid) {
             // Quick fetch if missing
             try {
                const res = await fetch(`/api/sessions/${sessionId}/status`);
                const data = await res.json();
                window.SESSION_DATA = Object.assign(window.SESSION_DATA || {}, data);
                facultyUid = data.facultyUid; // Update local var
             } catch(e) { console.error("Error fetching session data", e); }
        }

        // Check Facutly
        if(facultyUid && String(user.uid) === String(facultyUid)) {
            isFaculty = true;
            console.log(`👨‍🏫 FACULTY DETECTED by UID: ${user.uid}`);
        }
            
        // Get participant name from session data if available
        if(window.SESSION_DATA && window.SESSION_DATA.participants && !isScreenShare) {
            const participant = window.SESSION_DATA.participants.find(p => String(p.uid) === String(user.uid));
            if(participant) {
                pName = participant.name;
            }
        }

        let container = createVideoContainer(user.uid, pName);
        let targetId = "student-grid-container";

        if(isScreenShare) {
            // ALWAYS Enforce Presentation Mode for Screen Share
            console.log("🖥️ Screen Share Detected - Enforcing Presentation Mode");
            targetId = "presentation-content-area";
            
            // 1. Show Presentation Container
            const presentationContainer = document.getElementById("presentation-mode-container");
            if(presentationContainer) presentationContainer.classList.add('active');

            // 2. Hide Grid/Controls (via CSS class on body)
            document.body.classList.add('in-presentation');

            // 3. Move Faculty to PIP
            moveFacultyCameraToPIP(facultyUid);
        } else if(isFaculty) {
             // Only put faculty in primary if screen share is NOT active
             // Check if screen share (facultyUid + 1000000) exists in DOM
             const screenUid = Number(facultyUid) + 1000000;
             if(document.getElementById(`user-container-${screenUid}`)) {
                 console.log("🖥️ Screen share active, placing faculty in GRID");
                 targetId = "student-grid-container";
             } else {
                 targetId = "primary-video-container";
             }
        }

        console.log(`📍 Placing ${pName} (isFaculty=${isFaculty}, isScreen=${isScreenShare}) in: ${targetId}`);
        addToContainer(targetId, container);
        
        user.videoTrack.play(`user-${user.uid}`);
    }
    if(mediaType === 'audio') {
        user.audioTrack.play();
        console.log(`🔊 Audio playing for UID=${user.uid}`);
        
        // Handle Autoplay Policy
        AgoraRTC.onAudioAutoplayFailed = () => {
             console.warn("⚠️ Audio Autoplay Failed! interacting with DOM...");
             const btn = document.createElement("button");
             btn.innerText = "CLICK TO HEAR AUDIO";
             btn.style.position = "fixed";
             btn.style.top = "50%";
             btn.style.left = "50%";
             btn.style.zIndex = "9999";
             btn.style.padding = "20px";
             btn.style.background = "red";
             btn.style.color = "white";
             btn.onclick = () => {
                 user.audioTrack.play();
                 btn.remove();
             };
             document.body.appendChild(btn);
        };
    }
};

let handleRemoteMuteVideo = (user, muted) => {
    updatePlaceholder(user.uid, muted);
};

let handleUserLeft = (user) => {
    const el = document.getElementById(`user-container-${user.uid}`);
    if(el) el.remove();

    // Check if Screen Share Left (FacultyUID + 1000000)
    let facultyUid = window.SESSION_DATA ? window.SESSION_DATA.facultyUid : null;
    if(facultyUid && Number(user.uid) === Number(facultyUid) + 1000000) {
        console.log("🖥️ Screen Share Ended - Restoring Layout");
        
        // 1. Hide Presentation Container
        const presentationContainer = document.getElementById("presentation-mode-container");
        if(presentationContainer) presentationContainer.classList.remove('active');

        // 2. Restore Grid
        document.body.classList.remove('in-presentation');

        // 3. Restore Faculty Camera
        restoreFacultyCameraToPrimary(facultyUid);
    }

    // If faculty left, show waiting state?
    // We can check if parent was primary-video-container
    const primary = document.getElementById("primary-video-container");
    if(primary && primary.children.length <= 1) { // Only placeholder exists logic
         const ph = primary.querySelector('.empty-state-faculty');
         if(ph) ph.style.display = 'flex';
    }
};

function enforceCameraAlwaysOn(track) {
    track.on('track-ended', () => { alert("Camera must remain ON!"); location.reload(); });
}

async function leaveRoom() {
    for(let t of localTracks) { t.stop(); t.close(); }
    if(client) await client.leave();
    
    // API Call
    const endpoint = userRole === 'faculty' ? 'end' : 'leave';
    await fetch(`/api/sessions/${sessionId}/${endpoint}`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: userEmail, timestamp: new Date() })
    });
    
    window.close();
}

window.addEventListener("DOMContentLoaded", joinRoomInit);
window.joinRoomInit = joinRoomInit;
window.leaveRoom = leaveRoom;
window.isRTCActive = () => sessionActive;
window.stopScreenShare = stopScreenShare; // Expose for Teaching Mode

// ===============================================
// Layout Helpers
// ===============================================
function moveFacultyCameraToGrid(facultyUid) {
    if(!facultyUid) return;
    const facultyContainer = document.getElementById(`user-container-${facultyUid}`);
    
    // In Presentation Mode, we move faculty camera to "floating" position inside Primary
    // NOT to the grid.
    
    // Check if parent is primary (which it should be initially)
    if(facultyContainer) {
        console.log("⬇️ Moving Faculty Camera to FLOATING ASIDE");
        
        // Add class to body for global style changes (hiding grid)
        document.body.classList.add('presentation-mode');
        
        // Add floating class to faculty container
        facultyContainer.classList.add('floating-cam');
        
        // Ensure it is inside primary-video-container (it might already be there)
        const primary = document.getElementById("primary-video-container");
        if(facultyContainer.parentElement !== primary) {
            primary.appendChild(facultyContainer);
        }
    }
}

function restoreFacultyCameraToPrimary(facultyUid) {
    if(!facultyUid) return;
    const facultyContainer = document.getElementById(`user-container-${facultyUid}`);
    
    if(facultyContainer) {
         console.log("⬆️ Restoring Faculty Camera state");
         
         // Remove global class
         document.body.classList.remove('presentation-mode');
         
         // Remove floating class
         facultyContainer.classList.remove('floating-cam');
         
         // Ensure it is in primary (it should be, but just in case)
         const primary = document.getElementById("primary-video-container");
         if(facultyContainer.parentElement !== primary) {
            primary.appendChild(facultyContainer);
         }
    }
}

// ===============================================
// PRESENTATION MODE: Move Faculty to PIP
// ===============================================
function moveFacultyCameraToPIP(facultyUid) {
    if(!facultyUid) return;
    const facultyContainer = document.getElementById(`user-container-${facultyUid}`);
    
    if(facultyContainer) {
        console.log("📌 Moving Faculty Camera to PIP");
        
        // Move to PIP container
        const pipContainer = document.getElementById("faculty-pip-container");
        if(pipContainer) {
            pipContainer.innerHTML = ''; // Clear any existing content
            pipContainer.appendChild(facultyContainer);
        }
    }
}
