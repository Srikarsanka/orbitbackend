/* ===================================
   ORBIT - Class Recording Module
   Records faculty audio + video during live class
   =================================== */

(function() {
    'use strict';

    const API_BASE = 'https://orbitbackend-0i66.onrender.com';
    
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingStartTime = null;
    let timerInterval = null;
    let isRecording = false;

    /**
     * Initialize recording controls
     * Called after joinStream() completes
     */
    function initRecording() {
        const params = new URLSearchParams(window.location.search);
        const role = params.get('role');
        
        // Only faculty can record
        if (role !== 'faculty') {
            console.log('📹 Recording: Student mode, skipping');
            return;
        }

        console.log('📹 Recording module initialized for faculty');
    }

    /**
     * Start recording the session
     * Captures all audio (local + remote) and the local video
     */
    async function startRecording() {
        if (isRecording) return;

        try {
            // Get local tracks from the Agora SDK
            const localAudioTrack = window.localTracks ? window.localTracks[0] : null;
            const localVideoTrack = window.localTracks ? window.localTracks[1] : null;

            if (!localAudioTrack || !localVideoTrack) {
                alert('Cannot start recording: Audio/Video tracks not available');
                return;
            }

            // Create a combined MediaStream
            const audioStream = new MediaStream();
            const videoStream = new MediaStream();

            // Get native MediaStreamTrack from Agora track
            const nativeAudioTrack = localAudioTrack.getMediaStreamTrack();
            const nativeVideoTrack = localVideoTrack.getMediaStreamTrack();

            if (nativeAudioTrack) audioStream.addTrack(nativeAudioTrack);
            if (nativeVideoTrack) videoStream.addTrack(nativeVideoTrack);

            // Combine audio and video into one stream
            const combinedStream = new MediaStream([
                ...audioStream.getTracks(),
                ...videoStream.getTracks()
            ]);

            // Create MediaRecorder
            const options = { mimeType: 'video/webm;codecs=vp8,opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                // Fallback
                options.mimeType = 'video/webm';
            }

            mediaRecorder = new MediaRecorder(combinedStream, options);
            recordedChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                console.log('📹 Recording stopped, uploading...');
                uploadRecording();
            };

            mediaRecorder.onerror = (event) => {
                console.error('📹 Recording error:', event.error);
                stopRecording();
            };

            // Start recording (collect data every 1 second)
            mediaRecorder.start(1000);
            isRecording = true;
            recordingStartTime = Date.now();

            // Update UI
            updateRecordingUI(true);
            startTimer();

            console.log('📹 Recording started');
        } catch (error) {
            console.error('📹 Failed to start recording:', error);
            alert('Failed to start recording: ' + error.message);
        }
    }

    /**
     * Stop recording
     */
    function stopRecording() {
        if (!isRecording || !mediaRecorder) return;

        try {
            mediaRecorder.stop();
        } catch(e) { 
            console.warn('📹 MediaRecorder stop error:', e);
        }

        isRecording = false;
        clearInterval(timerInterval);
        updateRecordingUI(false);

        console.log('📹 Recording stopped');
    }

    /**
     * Upload the recorded blob to server
     */
    async function uploadRecording() {
        if (recordedChunks.length === 0) {
            console.warn('📹 No recorded data to upload');
            return;
        }

        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const duration = recordingStartTime ? Math.round((Date.now() - recordingStartTime) / 1000) : 0;

        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session');
        const email = params.get('email');
        const name = params.get('name');

        // Get classId from SESSION_DATA
        const classId = window.SESSION_DATA ? window.SESSION_DATA.classId : '';

        if (!sessionId || !classId) {
            console.error('📹 Missing sessionId or classId for upload');
            return;
        }

        // Show upload indicator
        showUploadStatus('Uploading recording...');

        const formData = new FormData();
        formData.append('recording', blob, `recording_${sessionId}.webm`);
        formData.append('sessionId', sessionId);
        formData.append('classId', classId);
        formData.append('facultyEmail', email || '');
        formData.append('facultyName', name || 'Faculty');
        formData.append('title', `Class Recording - ${new Date().toLocaleDateString()}`);
        formData.append('duration', duration.toString());

        try {
            const response = await fetch(`${API_BASE}/api/recordings/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                console.log('📹 Recording uploaded successfully:', result.recording.filename);
                showUploadStatus('Recording saved! ✓', true);
            } else {
                console.error('📹 Upload failed:', result.error);
                showUploadStatus('Upload failed ✗', false);
            }
        } catch (error) {
            console.error('📹 Upload error:', error);
            showUploadStatus('Upload failed ✗', false);
        }

        // Clear recorded data
        recordedChunks = [];
    }

    /**
     * Update recording button and indicator
     */
    function updateRecordingUI(recording) {
        const btn = document.getElementById('record-btn');
        const indicator = document.getElementById('recording-indicator');

        if (btn) {
            if (recording) {
                btn.classList.add('active', 'recording-active');
                btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
                btn.title = 'Stop Recording';
            } else {
                btn.classList.remove('active', 'recording-active');
                btn.innerHTML = '<i class="fa-solid fa-circle"></i>';
                btn.title = 'Start Recording';
            }
        }

        if (indicator) {
            indicator.style.display = recording ? 'flex' : 'none';
        }
    }

    /**
     * Start the recording timer
     */
    function startTimer() {
        const timerEl = document.getElementById('recording-timer');
        if (!timerEl) return;

        timerInterval = setInterval(() => {
            const elapsed = Math.round((Date.now() - recordingStartTime) / 1000);
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = (elapsed % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    /**
     * Show upload status notification
     */
    function showUploadStatus(message, success) {
        let toast = document.getElementById('recording-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'recording-toast';
            toast.style.cssText = `
                position: fixed; top: 80px; right: 24px; z-index: 99999;
                padding: 12px 20px; border-radius: 10px; font-size: 14px;
                font-weight: 600; font-family: 'Inter', sans-serif;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                transition: opacity 0.3s, transform 0.3s;
                display: flex; align-items: center; gap: 8px;
            `;
            document.body.appendChild(toast);
        }

        if (success === true) {
            toast.style.background = '#10b981';
            toast.style.color = 'white';
        } else if (success === false) {
            toast.style.background = '#ef4444';
            toast.style.color = 'white';
        } else {
            toast.style.background = '#000a45';
            toast.style.color = 'white';
        }

        toast.innerHTML = `<i class="fa-solid fa-${success === true ? 'check-circle' : success === false ? 'exclamation-circle' : 'cloud-arrow-up'}"></i> ${message}`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        if (success !== undefined) {
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }

    /**
     * Toggle recording on/off
     */
    function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    // Expose globally
    window.RecordingModule = {
        init: initRecording,
        toggle: toggleRecording,
        start: startRecording,
        stop: stopRecording,
        isRecording: () => isRecording
    };

    console.log('📹 Recording module loaded');
})();
