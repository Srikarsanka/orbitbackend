/**
 * Premium UI Adapter
 * Moves videos from original containers to premium layout
 * WITHOUT breaking existing JavaScript selectors
 * 
 * CRITICAL: Re-parents original video elements instead of cloning
 * to preserve MediaStream srcObject
 */

(function() {
    'use strict';

    console.log('🎨 Premium UI Adapter loaded');

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPremiumUI);
    } else {
        initPremiumUI();
    }

    function initPremiumUI() {
        console.log('🎨 Initializing Premium UI...');
        
        // Start observing for video elements
        observeVideoContainers();
        
        // Initial move of any existing videos
        setTimeout(() => {
            moveVideosToNewLayout();
        }, 1000);
    }

    /**
     * Observe for new video containers being added
     */
    function observeVideoContainers() {
        const originalContainer = document.getElementById('streams_container');
        const primaryContainer = document.getElementById('primary-video-container');
        
        if (!originalContainer) {
            console.warn('⚠️ streams_container not found');
            return;
        }

        // Observer for student videos
        const studentObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.classList && node.classList.contains('video__containers')) {
                            console.log('📹 New student video detected, moving to strip...');
                            setTimeout(() => moveStudentVideos(), 100);
                        }
                    });
                }
            });
        });

        studentObserver.observe(originalContainer, {
            childList: true,
            subtree: false
        });

        // Observer for faculty video
        if (primaryContainer) {
            const facultyObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.classList && node.classList.contains('video__containers')) {
                                console.log('👨‍🏫 Faculty video detected, moving to premium area...');
                                setTimeout(() => moveFacultyVideo(), 100);
                            }
                        });
                    }
                });
            });

            facultyObserver.observe(primaryContainer, {
                childList: true,
                subtree: false
            });
        }

        console.log('✅ Video observers initialized');
    }

    /**
     * Move videos from original containers to new premium layout
     */
    function moveVideosToNewLayout() {
        moveStudentVideos();
        moveFacultyVideo();
    }

    /**
     * Move student videos to horizontal participant strip
     * RE-PARENTS original elements (does NOT clone)
     */
    function moveStudentVideos() {
        const originalContainer = document.getElementById('streams_container');
        const premiumStrip = document.getElementById('participant-scroll');
        
        if (!originalContainer || !premiumStrip) {
            console.warn('⚠️ Container not found for student videos');
            return;
        }

        // Get all video containers from original location
        const videoContainers = originalContainer.querySelectorAll('.video__containers');
        
        if (videoContainers.length === 0) {
            console.log('📹 No student videos found yet');
            return;
        }

        console.log(`📹 Moving ${videoContainers.length} student videos to strip`);

        // RE-PARENT each video container to the premium strip
        videoContainers.forEach((container) => {
            // Check if already moved
            if (container.parentElement === premiumStrip) {
                return;
            }
            
            // Add premium styling class
            container.classList.add('premium-participant-tile');
            
            // RE-PARENT (move, don't clone) to premium strip
            premiumStrip.appendChild(container);
            
            console.log(`✅ Re-parented student video: ${container.id}`);
        });

        console.log('✅ Student videos moved to participant strip');
    }

    /**
     * Move faculty video to premium faculty section
     * RE-PARENTS original element (does NOT clone)
     */
    function moveFacultyVideo() {
        const primaryContainer = document.getElementById('primary-video-container');
        const premiumFaculty = document.getElementById('premium-faculty-container');
        
        if (!primaryContainer || !premiumFaculty) {
            console.warn('⚠️ Container not found for faculty video');
            return;
        }

        // Find faculty video container
        const facultyVideo = primaryContainer.querySelector('.video__containers');
        
        if (!facultyVideo) {
            console.log('👨‍🏫 No faculty video found yet');
            return;
        }

        // Check if already moved
        if (facultyVideo.parentElement === premiumFaculty) {
            return;
        }

        console.log('👨‍🏫 Moving faculty video to premium area');

        // Add premium styling class
        facultyVideo.classList.add('premium-faculty-video');
        
        // RE-PARENT (move, don't clone) to premium area
        // Remove pin indicator first if it exists
        const pinIndicator = premiumFaculty.querySelector('.faculty-pin-indicator');
        if (pinIndicator) {
            pinIndicator.remove();
        }
        
        // Clear any existing content
        premiumFaculty.innerHTML = '';
        
        // Move original element
        premiumFaculty.appendChild(facultyVideo);

        console.log('✅ Faculty video moved to premium section');
    }

    /**
     * Add active speaker highlight
     */
    function addActiveSpeakerHighlight(userId) {
        // Remove existing highlights
        document.querySelectorAll('.active-speaker').forEach(el => {
            el.classList.remove('active-speaker');
        });

        // Add highlight to active speaker
        const container = document.getElementById(`user-container-${userId}`);
        if (container) {
            container.classList.add('active-speaker');
        }
    }

    // Expose functions globally for external use
    window.PremiumUI = {
        moveVideosToNewLayout,
        moveStudentVideos,
        moveFacultyVideo,
        addActiveSpeakerHighlight
    };

    console.log('✅ Premium UI Adapter ready');
})();
