/**
 * Premium UI Adapter
 * Moves videos from original containers to premium layout
 * WITHOUT breaking existing JavaScript selectors
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
                    console.log('📹 New video detected, reorganizing layout...');
                    setTimeout(moveVideosToNewLayout, 100);
                }
            });
        });

        studentObserver.observe(originalContainer, {
            childList: true,
            subtree: true
        });

        // Observer for faculty video
        if (primaryContainer) {
            const facultyObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        console.log('👨‍🏫 Faculty video detected, moving to premium area...');
                        setTimeout(moveFacultyVideo, 100);
                    }
                });
            });

            facultyObserver.observe(primaryContainer, {
                childList: true,
                subtree: true
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

        // Move each video container to the premium strip
        videoContainers.forEach((container, index) => {
            // Clone the container to premium strip
            const clone = container.cloneNode(true);
            
            // Add premium styling classes
            clone.classList.add('premium-participant-tile');
            
            // Ensure name tag exists
            ensureNameTag(clone);
            
            // Append to premium strip
            premiumStrip.appendChild(clone);
            
            // Keep original hidden but in DOM for JS references
            container.style.display = 'none';
        });

        console.log('✅ Student videos moved to participant strip');
    }

    /**
     * Move faculty video to premium faculty section
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

        console.log('👨‍🏫 Moving faculty video to premium area');

        // Clone to premium area
        const clone = facultyVideo.cloneNode(true);
        clone.classList.add('premium-faculty-video');
        
        // Ensure name tag exists
        ensureNameTag(clone);
        
        // Clear previous and append new
        const existingFaculty = premiumFaculty.querySelector('.video__containers');
        if (existingFaculty) {
            existingFaculty.remove();
        }
        
        premiumFaculty.appendChild(clone);
        
        // Keep original hidden
        facultyVideo.style.display = 'none';

        console.log('✅ Faculty video moved to premium section');
    }

    /**
     * Ensure video container has a name tag
     */
    function ensureNameTag(container) {
        let nameTag = container.querySelector('.name-tag');
        
        if (!nameTag) {
            // Create name tag if it doesn't exist
            nameTag = document.createElement('div');
            nameTag.className = 'name-tag';
            
            // Try to get name from placeholder or generate generic name
            const placeholder = container.querySelector('.placeholder-name');
            const videoId = container.getAttribute('id') || '';
            
            if (placeholder) {
                nameTag.textContent = placeholder.textContent;
            } else if (videoId) {
                // Extract name from ID if possible
                const match = videoId.match(/user-container-(\d+)/);
                nameTag.textContent = match ? `User ${match[1]}` : 'Participant';
            } else {
                nameTag.textContent = 'Participant';
            }
            
            container.appendChild(nameTag);
        }
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
            
            // Also highlight in premium strip
            const premiumTile = document.querySelector(`.participant-scroll-container [id="user-container-${userId}"]`);
            if (premiumTile) {
                premiumTile.classList.add('active-speaker');
            }
        }
    }

    /**
     * Sync video states between original and premium containers
     */
    function syncVideoStates() {
        const originalVideos = document.querySelectorAll('#streams_container .video__containers');
        
        originalVideos.forEach(original => {
            const id = original.getAttribute('id');
            if (!id) return;
            
            const premiumClone = document.querySelector(`.participant-scroll-container [id="${id}"]`);
            if (!premiumClone) return;
            
            // Sync mute states, etc.
            const originalVideo = original.querySelector('video');
            const cloneVideo = premiumClone.querySelector('video');
            
            if (originalVideo && cloneVideo) {
                cloneVideo.muted = originalVideo.muted;
                cloneVideo.volume = originalVideo.volume;
            }
        });
    }

    // Expose functions globally for external use
    window.PremiumUI = {
        moveVideosToNewLayout,
        moveStudentVideos,
        moveFacultyVideo,
        addActiveSpeakerHighlight,
        syncVideoStates
    };

    console.log('✅ Premium UI Adapter ready');
})();
