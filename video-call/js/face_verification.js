// Face Verification Module for Video Call Join
// Handles face capture, verification API call, and 3-attempt limit

let verifyStream = null;
let verificationAttempts = 0;
const MAX_VERIFICATION_ATTEMPTS = 3;

// Show face verification modal
function showFaceVerificationModal() {
    console.log('🔐 Showing face verification modal');
    document.getElementById('faceVerificationModal').style.display = 'block';
    updateAttemptCounter();
}

// Hide face verification modal
function hideFaceVerificationModal() {
    console.log('✅ Hiding face verification modal');
    const modal = document.getElementById('faceVerificationModal');
    const statusDiv = document.getElementById('verifyStatus');
    const videoFrame = document.getElementById('videoFrame');
    
    // Hide modal
    modal.style.display = 'none';
    
    // Stop camera
    stopVerifyCamera();
    
    // Clear status
    statusDiv.innerHTML = '';
    statusDiv.className = '';
    
    // Remove active state from video frame
    videoFrame.classList.remove('active');
    
    console.log('✅ Modal hidden and reset complete');
}

// Update attempt counter display
function updateAttemptCounter() {
    const counter = document.getElementById('attemptCounter');
    const remaining = MAX_VERIFICATION_ATTEMPTS - verificationAttempts;
    
    if (verificationAttempts === 0) {
        counter.innerHTML = `<i class="fa-solid fa-shield-check"></i><span>${MAX_VERIFICATION_ATTEMPTS} attempts available</span>`;
        counter.className = 'attempt-display';
    } else if (remaining > 0) {
        counter.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${remaining} attempt${remaining > 1 ? 's' : ''} remaining</span>`;
        counter.className = remaining === 1 ? 'attempt-display warning' : 'attempt-display';
    } else {
        counter.innerHTML = '<i class="fa-solid fa-ban"></i><span>No attempts remaining</span>';
        counter.className = 'attempt-display warning';
    }
}

// Start verification camera
async function startVerifyCamera() {
    console.log('📷 Starting verification camera');
    const statusDiv = document.getElementById('verifyStatus');
    const videoFrame = document.getElementById('videoFrame');
    const cameraPlaceholder = document.getElementById('cameraPlaceholder');
    const video = document.getElementById('verifyVideo');
    
    try {
        verifyStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } 
        });
        
        video.srcObject = verifyStream;
        
        // Hide placeholder, show video
        cameraPlaceholder.style.display = 'none';
        video.style.display = 'block';
        videoFrame.classList.add('active');
        
        // Show capture button, hide start button
        document.getElementById('startVerifyCamera').style.display = 'none';
        document.getElementById('captureVerifyPhoto').style.display = 'inline-flex';
        
        statusDiv.innerHTML = '<i class="fa-solid fa-video"></i><p>Camera active. Position your face in the frame</p>';
        statusDiv.className = 'status-message loading';
        
    } catch (error) {
        console.error('❌ Camera error:', error);
        statusDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><p>Camera access denied. Please enable camera permissions</p>';
        statusDiv.className = 'status-message error';
    }
}

// Stop verification camera
function stopVerifyCamera() {
    if (verifyStream) {
        verifyStream.getTracks().forEach(track => track.stop());
        verifyStream = null;
    }
    
    const video = document.getElementById('verifyVideo');
    const videoFrame = document.getElementById('videoFrame');
    const cameraPlaceholder = document.getElementById('cameraPlaceholder');
    
    video.srcObject = null;
    video.style.display = 'none';
    cameraPlaceholder.style.display = 'flex';
    videoFrame.classList.remove('active');
    
    // Reset buttons
    document.getElementById('startVerifyCamera').style.display = 'inline-flex';
    document.getElementById('captureVerifyPhoto').style.display = 'none';
}

// Capture photo and verify
async function captureVerifyPhoto() {
    console.log('📸 Capturing verification photo');
    const statusDiv = document.getElementById('verifyStatus');
    
    // Show loading
    statusDiv.innerHTML = '<span class="loading-spinner"></span><p>Analyzing your face...</p>';
    statusDiv.className = 'status-message loading';
    
    // Disable button during verification
    const captureBtn = document.getElementById('captureVerifyPhoto');
    captureBtn.disabled = true;
    
    try {
        // Capture photo from video
        const video = document.getElementById('verifyVideo');
        const canvas = document.getElementById('verifyCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        // Get session details from URL
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session');
        const classId = urlParams.get('class');
        
        console.log('📋 URL Parameters:', {
            sessionId,
            classId,
            userEmail,
            userRole,
            hasPhoto: !!photoBase64
        });
        
        // Call verification API
        const response = await fetch('/api/video-call/verify-join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: userEmail,
                classId: classId,
                sessionId: sessionId,
                photoBase64: photoBase64,
                role: userRole
            })
        });
        
        const result = await response.json();
        
        if (result.verified) {
            // Verification successful
            console.log('✅ Face verification successful:', result);
            statusDiv.innerHTML = `<i class="fa-solid fa-circle-check"></i><p>Verification successful! ${result.similarity ? `(${result.similarity} match)` : 'Welcome!'}</p>`;
            statusDiv.className = 'status-message success';
            
            console.log('⏱️ Starting 1.5s timer to hide modal...');
            
            // Hide modal after 1.5 seconds and proceed to join
            setTimeout(() => {
                console.log('🔄 Timer completed, hiding modal now...');
                hideFaceVerificationModal();
                verificationAttempts = 0; // Reset attempts on success
                console.log('🚀 Proceeding to join call...');
                proceedToJoinCall(); // Continue with normal join flow
            }, 1500);
            
        } else {
            // Verification failed
            verificationAttempts++;
            updateAttemptCounter();
            
            console.log(`❌ Face verification failed (Attempt ${verificationAttempts}/${MAX_VERIFICATION_ATTEMPTS}):`, result);
            
            let errorMessage = result.message || 'Verification failed';
            let errorIcon = 'fa-triangle-exclamation';
            
            // Add specific guidance based on error reason
            if (result.reason === 'FACE_MISMATCH') {
                errorMessage += '. Please ensure good lighting and face the camera directly.';
                errorIcon = 'fa-user-slash';
            } else if (result.reason === 'NO_FACE_DETECTED') {
                errorMessage += '. Make sure your face is clearly visible.';
                errorIcon = 'fa-face-frown';
            } else if (result.reason === 'NOT_ENROLLED') {
                errorMessage += '. You are not enrolled in this class.';
                errorIcon = 'fa-ban';
            }
            
            statusDiv.innerHTML = `<i class="fa-solid ${errorIcon}"></i><p>${errorMessage}</p>`;
            statusDiv.className = 'status-message error';
            
            // Check if max attempts reached
            if (verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
                // Show cooldown message with timer
                const cooldownMinutes = 2;
                const cooldownSeconds = cooldownMinutes * 60;
                let remainingSeconds = cooldownSeconds;
                
                // Disable all buttons
                captureBtn.disabled = true;
                document.getElementById('startVerifyCamera').disabled = true;
                
                // Function to format time
                const formatTime = (seconds) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                };
                
                // Update status with countdown
                const updateCooldownStatus = () => {
                    if (remainingSeconds > 0) {
                        statusDiv.innerHTML = `
                            <i class="fa-solid fa-clock"></i>
                            <p>Maximum attempts reached. Please wait <strong>${formatTime(remainingSeconds)}</strong> before trying again.</p>
                        `;
                        statusDiv.className = 'status-message error';
                        remainingSeconds--;
                        setTimeout(updateCooldownStatus, 1000);
                    } else {
                        // Reset after cooldown
                        verificationAttempts = 0;
                        updateAttemptCounter();
                        captureBtn.disabled = false;
                        document.getElementById('startVerifyCamera').disabled = false;
                        statusDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i><p>You can try again now</p>';
                        statusDiv.className = 'status-message loading';
                    }
                };
                
                updateCooldownStatus();
            } else {
                // Re-enable button for retry
                captureBtn.disabled = false;
            }
        }
        
    } catch (error) {
        console.error('❌ Verification error:', error);
        statusDiv.innerHTML = '<i class="fa-solid fa-wifi"></i><p>Network error. Please try again.</p>';
        statusDiv.className = 'status-message error';
        captureBtn.disabled = false;
    }
}

// Proceed to join call after successful verification
async function proceedToJoinCall() {
    console.log('🚀 Proceeding to join call after verification');
    // This will be called after successful verification
    // The existing joinRoomInit() will continue normally
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const startCameraBtn = document.getElementById('startVerifyCamera');
    const captureBtn = document.getElementById('captureVerifyPhoto');
    
    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', startVerifyCamera);
    }
    
    if (captureBtn) {
        captureBtn.addEventListener('click', captureVerifyPhoto);
    }
});

// Export functions for use in room_rtc_enhanced.js
window.FaceVerification = {
    show: showFaceVerificationModal,
    hide: hideFaceVerificationModal,
    verify: captureVerifyPhoto,
    resetAttempts: () => { verificationAttempts = 0; }
};
