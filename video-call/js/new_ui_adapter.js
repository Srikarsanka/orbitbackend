/**
 * NEW UI LAYOUT ADAPTER
 * Bridges existing video stream logic with the new horizontal strip + pinned video layout
 * Preserves all existing faculty pinning and screen sharing logic
 */

(function() {
    'use strict';

    console.log('[New UI Adapter] Initializing layout adapter for new video call UI');

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNewLayout);
    } else {
        initNewLayout();
    }

    function initNewLayout() {
        console.log('[New UI Adapter] DOM ready, setting up new layout handlers');

        // Monitor the streams_container for new video elements
        const streamsContainer = document.getElementById('streams_container');
        if (!streamsContainer) {
            console.error('[New UI Adapter] streams_container not found');
            return;
        }

        // Create a MutationObserver to watch for video additions
        const observer = new MutationObserver(handleVideoChanges);
        observer.observe(streamsContainer, {
            childList: true,
            subtree: true
        });

        // Handle exit button
        const exitBtn = document.getElementById('exit-class-btn');
        if (exitBtn) {
            exitBtn.addEventListener('click', function() {
                const leaveBtn = document.getElementById('leave-btn');
                if (leaveBtn) {
                    leaveBtn.click();
                }
            });
        }

        console.log('[New UI Adapter] Layout adapter initialized');
    }

    function handleVideoChanges(mutations) {
        console.log('[New UI Adapter] Video changes detected');
        
        const streamsContainer = document.getElementById('streams_container');
        const studentStrip = document.getElementById('student-video-container');
        const pinnedDisplay = document.getElementById('pinned-video-display');
        
        if (!streamsContainer || !studentStrip || !pinnedDisplay) {
            console.error('[New UI Adapter] Required containers not found');
            return;
        }

        // Get all video containers
        const videoContainers = streamsContainer.querySelectorAll('.video__containers');
        
        if (videoContainers.length === 0) {
            console.log('[New UI Adapter] No video containers found yet');
            return;
        }

        console.log(`[New UI Adapter] Found ${videoContainers.length} video containers`);

        // Clear existing cards in student strip
        studentStrip.innerHTML = '';

        let facultyVideo = null;
        const studentVideos = [];

        // Separate faculty and students
        videoContainers.forEach(container => {
            const nameTag = container.querySelector('.name-tag');
            const isFaculty = container.classList.contains('faculty-video') || 
                            (nameTag && nameTag.textContent.toLowerCase().includes('faculty'));
            
            if (isFaculty) {
                facultyVideo = container;
            } else {
                studentVideos.push(container);
            }
        });

        // Handle faculty video (pinned large display)
        if (facultyVideo) {
            console.log('[New UI Adapter] Moving faculty video to pinned display');
            pinnedDisplay.innerHTML = '';
            
            // Clone the faculty video for the pinned display
            const facultyClone = facultyVideo.cloneNode(true);
            facultyClone.style.width = '100%';
            facultyClone.style.height = '100%';
            facultyClone.style.maxWidth = '1200px';
            facultyClone.style.maxHeight = '700px';
            pinnedDisplay.appendChild(facultyClone);
        }

        // Handle student videos (horizontal strip)
        studentVideos.forEach((studentVideo, index) => {
            console.log(`[New UI Adapter] Adding student ${index + 1} to horizontal strip`);
            
            // Create a card for the horizontal strip
            const card = document.createElement('div');
            card.className = 'student-video-card';
            card.dataset.studentId = index;

            // Clone the video element
            const videoClone = studentVideo.cloneNode(true);
            videoClone.style.width = '100%';
            videoClone.style.height = '100%';
            
            // Get student name
            const nameTag = studentVideo.querySelector('.name-tag');
            const studentName = nameTag ? nameTag.textContent : `Student ${index + 1}`;

            // Create name overlay
            const nameOverlay = document.createElement('div');
            nameOverlay.className = 'name-overlay';
            nameOverlay.textContent = studentName;

            // Create pin icon
            const pinIcon = document.createElement('div');
            pinIcon.className = 'pin-icon';
            pinIcon.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
            pinIcon.title = 'Pin this video';
            
            // Add click handler for pinning
            pinIcon.addEventListener('click', function() {
                handlePinStudent(studentVideo, card);
            });

            // Assemble the card
            card.appendChild(videoClone);
            card.appendChild(nameOverlay);
            card.appendChild(pinIcon);

            // Add to strip
            studentStrip.appendChild(card);
        });

        console.log('[New UI Adapter] Layout update complete');
    }

    function handlePinStudent(originalVideo, card) {
        console.log('[New UI Adapter] Pinning student video');
        
        const pinnedDisplay = document.getElementById('pinned-video-display');
        const allCards = document.querySelectorAll('.student-video-card');
        
        // Remove pinned class from all cards
        allCards.forEach(c => c.classList.remove('pinned'));
        
        // Add pinned class to this card
        card.classList.add('pinned');
        
        // Clone and display in main workspace
        pinnedDisplay.innerHTML = '';
        const clone = originalVideo.cloneNode(true);
        clone.style.width = '100%';
        clone.style.height = '100%';
        clone.style.maxWidth = '1200px';
        clone.style.maxHeight = '700px';
        pinnedDisplay.appendChild(clone);
    }

    // Make functions available globally if needed
    window.newUIAdapter = {
        handleVideoChanges: handleVideoChanges
    };

})();
