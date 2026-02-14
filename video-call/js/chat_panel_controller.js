/**
 * Chat Panel Controller for New UI
 * Handles opening/closing of the slide-in chat panel
 */

(function() {
    'use strict';

    console.log('[Chat Panel] Initializing chat panel controller');

    document.addEventListener('DOMContentLoaded', function() {
        const chatBtn = document.getElementById('open_chat_btn');
        const chatPanel = document.getElementById('chat_section');
        const chatBackBtn = document.getElementById('chat_back');

        if (!chatBtn || !chatPanel) {
            console.error('[Chat Panel] Required elements not found');
            return;
        }

        // Open chat panel
        chatBtn.addEventListener('click', function() {
            console.log('[Chat Panel] Opening chat panel');
            chatPanel.classList.add('open');
            chatBtn.classList.add('active');
        });

        // Close chat panel
        if (chatBackBtn) {
            chatBackBtn.addEventListener('click', function() {
                console.log('[Chat Panel] Closing chat panel');
                chatPanel.classList.remove('open');
                chatBtn.classList.remove('active');
            });
        }

        console.log('[Chat Panel] Chat panel controller initialized');
    });

})();
