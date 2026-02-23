/* ===================================
   ORBIT - Class Recording Module
   Records faculty audio + video during live class
   Uploads to Cloudinary via backend API
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
            console.log('📹 Recording: Student mode, hiding record button');
            const btn = document.getElementById('record-btn');
            if (btn) btn.style.display = 'none';
            return;
        }

        console.log('📹 Recording module initialized for faculty');
        console.log('📹 localTracks available:', !!window.localTracks, 
                     'audio:', !!(window.localTracks && window.localTracks[0]),
                     'video:', !!(window.localTracks && window.localTracks[1]));
        console.log('📹 SESSION_DATA available:', !!window.SESSION_DATA,
                     'classId:', window.SESSION_DATA ? window.SESSION_DATA.classId : 'N/A');
    }

    /**
     * Start recording the session
     * Captures local audio + video from Agora tracks
     */
    async function startRecording() {
        if (isRecording) {
            console.warn('📹 Already recording');
            return;
        }

        try {
            console.log('📹 Attempting to start recording...');
            
            // Get local tracks from Agora SDK (exposed globally)
            const localAudioTrack = window.localTracks ? window.localTracks[0] : null;
            const localVideoTrack = window.localTracks ? window.localTracks[1] : null;

            console.log('📹 Audio track:', localAudioTrack ? 'Found' : 'MISSING');
            console.log('📹 Video track:', localVideoTrack ? 'Found' : 'MISSING');

            if (!localAudioTrack && !localVideoTrack) {
                const msg = 'Cannot record: No audio or video tracks available. Please ensure your mic/camera are on.';
                console.error('📹 ' + msg);
                showUploadStatus(msg, false);
                return;
            }

            // Build combined MediaStream from available Agora tracks
            const combinedStream = new MediaStream();
            let tracksAdded = 0;

            if (localAudioTrack) {
                try {
                    const nativeAudio = localAudioTrack.getMediaStreamTrack();
                    if (nativeAudio && nativeAudio.readyState === 'live') {
                        combinedStream.addTrack(nativeAudio);
                        tracksAdded++;
                        console.log('📹 Audio track added to recording stream');
                    } else {
                        console.warn('📹 Audio track not live:', nativeAudio ? nativeAudio.readyState : 'null');
                    }
                } catch(e) {
                    console.warn('📹 Failed to get audio MediaStreamTrack:', e);
                }
            }

            if (localVideoTrack) {
                try {
                    const nativeVideo = localVideoTrack.getMediaStreamTrack();
                    if (nativeVideo && nativeVideo.readyState === 'live') {
                        combinedStream.addTrack(nativeVideo);
                        tracksAdded++;
                        console.log('📹 Video track added to recording stream');
                    } else {
                        console.warn('📹 Video track not live:', nativeVideo ? nativeVideo.readyState : 'null');
                    }
                } catch(e) {
                    console.warn('📹 Failed to get video MediaStreamTrack:', e);
                }
            }

            if (tracksAdded === 0) {
                showUploadStatus('Recording failed: Could not access media tracks', false);
                return;
            }

            console.log('📹 Combined stream tracks:', combinedStream.getTracks().length);

            // Choose best available codec
            let mimeType = '';
            const codecs = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm;codecs=vp8',
                'video/webm',
                'video/mp4'
            ];
            
            for (const codec of codecs) {
                if (MediaRecorder.isTypeSupported(codec)) {
                    mimeType = codec;
                    break;
                }
            }

            if (!mimeType) {
                showUploadStatus('Recording not supported in this browser', false);
                console.error('📹 No supported recording codec found');
                return;
            }

            console.log('📹 Using codec:', mimeType);

            // Create MediaRecorder
            const options = { mimeType, videoBitsPerSecond: 2500000 }; // 2.5 Mbps
            mediaRecorder = new MediaRecorder(combinedStream, options);
            recordedChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                console.log('📹 MediaRecorder stopped, chunks:', recordedChunks.length);
                const totalSize = recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                console.log('📹 Total recorded size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
                uploadRecording();
            };

            mediaRecorder.onerror = (event) => {
                console.error('📹 MediaRecorder error:', event.error || event);
                showUploadStatus('Recording error occurred', false);
                stopRecording();
            };

            // Start recording - collect data every 1 second
            mediaRecorder.start(1000);
            isRecording = true;
            recordingStartTime = Date.now();

            // Update UI
            updateRecordingUI(true);
            startTimer();

            showUploadStatus('🔴 Recording started', undefined);
            console.log('📹 ✅ Recording started successfully!');

        } catch (error) {
            console.error('📹 Failed to start recording:', error);
            showUploadStatus('Failed to start recording: ' + error.message, false);
        }
    }

    /**
     * Stop recording
     */
    function stopRecording() {
        if (!isRecording || !mediaRecorder) {
            console.warn('📹 Not recording, nothing to stop');
            return;
        }

        try {
            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        } catch(e) { 
            console.warn('📹 MediaRecorder stop error:', e);
        }

        isRecording = false;
        clearInterval(timerInterval);
        updateRecordingUI(false);

        console.log('📹 Recording stopped');
    }

    /**
     * Upload the recorded blob to server (→ Cloudinary)
     */
    async function uploadRecording() {
        if (recordedChunks.length === 0) {
            console.warn('📹 No recorded data to upload');
            showUploadStatus('No recording data captured', false);
            return;
        }

        const blob = new Blob(recordedChunks, { type: mediaRecorder ? mediaRecorder.mimeType : 'video/webm' });
        const duration = recordingStartTime ? Math.round((Date.now() - recordingStartTime) / 1000) : 0;

        console.log('📹 Uploading recording: size=' + (blob.size / 1024 / 1024).toFixed(2) + 'MB, duration=' + duration + 's');

        const params = new URLSearchParams(window.location.search);
        const sessionIdParam = params.get('session') || params.get('room');
        const email = params.get('email');
        const name = params.get('name');

        // Get classId from SESSION_DATA (set during continueJoinFlow)
        const classId = window.SESSION_DATA ? window.SESSION_DATA.classId : '';

        if (!sessionIdParam) {
            console.error('📹 Missing sessionId for upload');
            showUploadStatus('Upload failed: Missing session info', false);
            return;
        }

        if (!classId) {
            console.warn('📹 Missing classId, attempting upload without it...');
        }

        // Show upload indicator
        showUploadStatus('⬆️ Uploading recording to cloud...', undefined);

        const formData = new FormData();
        formData.append('recording', blob, `recording_${sessionIdParam}_${Date.now()}.webm`);
        formData.append('sessionId', sessionIdParam);
        formData.append('classId', classId || '');
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

            if (!response.ok) {
                let errMsg = `Server error (${response.status})`;
                try {
                    const errData = await response.json();
                    console.error('📹 Upload response error:', response.status, errData);
                    errMsg = errData.details || errData.error || errMsg;
                } catch(parseErr) {
                    const errText = await response.text();
                    console.error('📹 Upload response error:', response.status, errText);
                    errMsg = errText.substring(0, 100) || errMsg;
                }
                showUploadStatus('Upload failed: ' + errMsg, false);
                return;
            }

            const result = await response.json();

            if (result.success) {
                console.log('📹 ✅ Recording uploaded successfully:', result.recording.fileUrl || result.recording.filename);
                showUploadStatus('✅ Recording saved to cloud!', true);
            } else {
                console.error('📹 Upload failed:', result.error);
                showUploadStatus('Upload failed: ' + (result.error || 'Unknown error'), false);
            }
        } catch (error) {
            console.error('📹 Upload error:', error.message || error);
            showUploadStatus('Upload failed: ' + (error.message || 'Network error'), false);
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
                btn.style.background = 'rgba(220, 38, 38, 0.9)';
                btn.style.color = 'white';
            } else {
                btn.classList.remove('active', 'recording-active');
                btn.innerHTML = '<i class="fa-solid fa-circle"></i>';
                btn.title = 'Start Recording';
                btn.style.background = '';
                btn.style.color = '';
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
                max-width: 350px;
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
            toast.style.background = '#1e293b';
            toast.style.color = 'white';
        }

        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        if (success !== undefined) {
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }
    }

    /**
     * Toggle recording on/off
     */
    function toggleRecording() {
        console.log('📹 Toggle recording called, isRecording:', isRecording);
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
