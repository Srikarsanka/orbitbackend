/**
 * Attendance Client
 * Handles client-side face capture and attendance tracking
 */

const AttendanceClient = {
  intervalId: null,
  sessionId: null,
  participantEmail: null,
  participantName: null,
  captureIntervalMs: 60000, // 60 seconds
  isTracking: false,
  intervalCount: 0,
  
  /**
   * Initialize attendance tracking
   * @param {String} sessionId 
   * @param {String} email 
   * @param {String} name 
   * @param {Object} config - Optional config override
   */
  init: async function(sessionId, email, name, config = {}) {
    console.log('📝 Initializing Attendance Client...', { sessionId, email, name });
    
    this.sessionId = sessionId;
    this.participantEmail = email;
    this.participantName = name;
    
    if (config.captureInterval) {
      this.captureIntervalMs = config.captureInterval * 1000;
    }
    
    // Start tracking if not already started
    if (!this.isTracking) {
      this.startTracking();
    }
  },
  
  /**
   * Start the capture interval
   */
  startTracking: function() {
    if (this.isTracking) return;
    
    console.log(`⏱️ Starting attendance tracking (Interval: ${this.captureIntervalMs}ms)`);
    this.isTracking = true;
    
    // Initial capture immediately (or after a small delay to ensure video is stable)
    setTimeout(() => this.captureAndSend(), 5000);
    
    // Set interval
    this.intervalId = setInterval(() => {
      this.captureAndSend();
    }, this.captureIntervalMs);
  },
  
  /**
   * Stop tracking
   */
  stopTracking: function() {
    console.log('🛑 Stopping attendance tracking');
    this.isTracking = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },
  
  /**
   * Capture frame and send to backend
   */
  captureAndSend: async function() {
    if (!this.isTracking) return;
    
    try {
      // Get local video track from global variable (from room_rtc_enhanced.js)
      // Check if localTracks exists and has video (usually index 1)
      if (!window.localTracks || !window.localTracks[1] || !window.localTracks[1].isPlaying) {
        console.warn('⚠️ No active local video track found for attendance capture');
        return;
      }
      
      const videoTrack = window.localTracks[1];
      
      // We need to get the actual <video> element to draw from
      // Agora plays the track in a container with ID `user-{uid}`
      // Or we can create a temporary video element from the MediaStreamTrack
      
      const mediaStreamTrack = videoTrack.getMediaStreamTrack();
      if (!mediaStreamTrack || !mediaStreamTrack.enabled || mediaStreamTrack.readyState !== 'live') { // Fix: Check readyState
        console.warn('⚠️ Local video track is not active or muted');
        return;
      }

      // Capture frame using ImageCapture (if supported) or Canvas
      let photoBase64 = null;
      
      if (window.ImageCapture) {
        try {
          const imageCapture = new ImageCapture(mediaStreamTrack);
          const blob = await imageCapture.takePhoto();
          photoBase64 = await this.blobToBase64(blob);
        } catch (e) {
          console.warn('⚠️ ImageCapture failed, falling back to Canvas:', e);
          photoBase64 = await this.captureFromCanvas(mediaStreamTrack);
        }
      } else {
        photoBase64 = await this.captureFromCanvas(mediaStreamTrack);
      }
      
      if (!photoBase64) {
        console.error('❌ Failed to capture photo');
        return;
      }
      
      // Increment interval count
      this.intervalCount++;
      
      // Send to backend
      this.sendAttendanceData(photoBase64);
      
    } catch (err) {
      console.error('❌ Error during attendance capture:', err);
    }
  },
  
  /**
   * Capture frame using Canvas and temporary video element
   */
  captureFromCanvas: async function(mediaStreamTrack) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = new MediaStream([mediaStreamTrack]);
      
      video.onloadedmetadata = () => {
        video.play().then(() => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Cleanup
          video.pause();
          video.srcObject = null;
          resolve(dataUrl);
        }).catch(err => {
            console.error("Error playing temp video for capture:", err);
            resolve(null);
        });
      };
      
      video.onerror = (err) => {
          console.error("Error loading temp video for capture:", err);
          resolve(null);
      }
    });
  },
  
  /**
   * Convert Blob to Base64
   */
  blobToBase64: function(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },
  
  /**
   * Send captured data to backend
   */
  sendAttendanceData: async function(photoBase64) {
    console.log(`📡 Sending attendance capture #${this.intervalCount}...`);
    
    try {
      const response = await fetch('/api/attendance/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          participantEmail: this.participantEmail,
          participantName: this.participantName,
          intervalNumber: this.intervalCount,
          photoBase64: photoBase64
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.interval.matchResult) {
            console.log('✅ Attendance verified (Match)');
            this.updateVideoBorder('verified'); // Green border
        } else {
            console.warn('⚠️ Attendance match failed', result.interval.error);
            this.updateVideoBorder('failed'); // Red border
        }
      } else {
        console.error('❌ Attendance API error:', result.error);
        this.updateVideoBorder('failed'); // Red border on error
      }
      
    } catch (err) {
      console.error('❌ Network error sending attendance:', err);
      this.updateVideoBorder('failed'); // Red border on network error
    }
  },
  
  /**
   * Update video border based on verification status
   * @param {String} status - 'verified' or 'failed'
   */
  updateVideoBorder: function(status) {
    // Find the local user's video container
    // Agora creates containers with ID pattern: user-{uid}
    const localUid = window.localUid || window.uid;
    if (!localUid) return;
    
    const videoContainer = document.getElementById(`user-${localUid}`);
    if (!videoContainer) {
      console.warn('Could not find video container for border update');
      return;
    }
    
    // Remove existing status classes
    videoContainer.classList.remove('attendance-verified', 'attendance-failed');
    
    // Add new status class
    if (status === 'verified') {
      videoContainer.classList.add('attendance-verified');
      console.log('🟢 Video border: GREEN (verified)');
    } else {
      videoContainer.classList.add('attendance-failed');
      console.log('🔴 Video border: RED (failed)');
    }
    
    // Auto-remove the border after 5 seconds to avoid clutter
    setTimeout(() => {
      videoContainer.classList.remove('attendance-verified', 'attendance-failed');
    }, 5000);
  }
};

// Expose globally
window.AttendanceClient = AttendanceClient;
