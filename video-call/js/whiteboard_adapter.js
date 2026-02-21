/**
 * EnhancedWhiteboard Adapter
 * Extends CollaborativeWhiteboard to add premium features without modifying core logic.
 */
class EnhancedWhiteboard extends CollaborativeWhiteboard {
    constructor(canvasId, socket, sessionId, userEmail, userRole, userName) {
        super(canvasId, socket, sessionId, userEmail, userRole, userName);
        
        // Extended state
        this.history = []; // Local history for undo (since server only stores throttled points)
        this.redoStack = [];
        this.isEraserActive = false;
        this.savedLineWidth = this.lineWidth;
        
        // Text Tool State
        this.isTextToolActive = false;
        this.textInput = null;
        
        // Bind new methods
        this.handleTextClick = this.handleTextClick.bind(this);
        
        // Listen for shape additions to update local history
        if (this.socket) {
            this.socket.on('whiteboard:add-shape', (data) => {
                // We don't add remote shapes to local undo stack to avoid undoing others' work
                // But we could visualize them
            });
        }
        
        console.log('✨ EnhancedWhiteboard Initialized');
    }

    // Override setTool to handle Text and Eraser specially
    setTool(tool) {
        // Deactivate special modes
        if (this.isTextToolActive) {
            this.deactivateTextTool();
        }
        
        this.isEraserActive = (tool === 'eraser');
        this.isTextToolActive = (tool === 'text');
        
        if (this.isEraserActive) {
            // Eraser is just drawing with white color
            this.ctx.globalCompositeOperation = 'destination-out'; // This makes it transparent
            // OR use white color if background is white?
            // whiteboard_canvas.js uses clearRect for clear, but drawLine for drawing.
            // drawLine uses stroke().
            // If we use destination-out, it erases to transparent.
            // If the canvas has a white background set via CSS, transparent shows the CSS background (white).
            // Let's rely on standard logic but set color to 'white' if destination-out isn't desired.
            // But 'destination-out' is better for true erasing.
             this.ctx.globalCompositeOperation = 'source-over'; // Reset first
             this.currentColor = '#ffffff'; // Simple "paint white" approach for safety with existing sync
             this.savedLineWidth = this.lineWidth; // Save current width
             this.setLineWidth(20); // Default eraser size
             super.setTool('pen'); // Treat as pen to existing logic
             
             // Visual cursor update handled by UI
        } else if (this.isTextToolActive) {
            super.setTool('text'); // "text" might not be handled by draw() in base, but we intercept startDrawing
            this.canvas.style.cursor = 'text';
            this.activateTextTool();
        } else {
            // Normal Pen
            this.ctx.globalCompositeOperation = 'source-over';
            if (this.currentColor === '#ffffff') {
                this.currentColor = '#000000'; // Reset to black if coming from eraser
            }
            // Restore line width if coming from eraser
             if (this.currentTool === 'eraser' || this.currentTool === 'pen') { // Check previous
                 // simple reset
             }
             
            super.setTool(tool);
        }
        
        this.currentTool = tool; // Keep track locally
    }
    
    // Override startDrawing to intercept Text tool
    startDrawing(e) {
        if (this.isTextToolActive) {
            // Don't draw, place text input
            this.handleTextClick(e);
            return;
        }
        super.startDrawing(e);
    }

    // Text Tool Implementation
    activateTextTool() {
        this.canvas.addEventListener('click', this.handleTextClick);
    }

    deactivateTextTool() {
        this.canvas.removeEventListener('click', this.handleTextClick);
        this.removeTextInput();
    }

    handleTextClick(e) {
        if (!this.hasPermission) {
            this.showNotification('⚠️ You do not have permission to add text');
            return;
        }
        
        // Don't trigger if clicking on existing input
        if (e.target.tagName === 'INPUT') return;

        const pos = this.getMousePos(e);
        this.createTextInput(pos.x, pos.y);
    }

    createTextInput(x, y) {
        this.removeTextInput();

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'wb-text-input';
        input.style.position = 'absolute';
        input.style.left = (x + this.canvas.offsetLeft) + 'px';
        input.style.top = (y + this.canvas.offsetTop) + 'px';
        input.style.zIndex = '1000';
        input.style.background = 'transparent';
        input.style.border = '1px dashed #333';
        input.style.font = '16px Inter, sans-serif';
        input.style.color = this.currentColor !== '#ffffff' ? this.currentColor : '#000000';
        input.style.padding = '4px';
        input.style.minWidth = '100px';
        
        input.placeholder = 'Type here...';

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.commitText(input.value, x, y);
                this.removeTextInput();
            }
            if (e.key === 'Escape') {
                this.removeTextInput();
            }
        });

        input.addEventListener('blur', () => {
             if (input.value.trim()) {
                 this.commitText(input.value, x, y);
             }
             this.removeTextInput();
        });

        this.canvas.parentElement.appendChild(input);
        input.focus();
        this.textInput = input;
    }

    removeTextInput() {
        if (this.textInput) {
            this.textInput.remove();
            this.textInput = null;
        }
    }

    commitText(text, x, y) {
        if (!text.trim()) return;

        // Draw locally
        this.ctx.font = '16px Inter, sans-serif';
        this.ctx.fillStyle = this.currentColor !== '#ffffff' ? this.currentColor : '#000000';
        this.ctx.fillText(text, x, y);

        const shapePayload = {
            type: 'text',
            x: x, 
            y: y,
            text: text,
            color: this.ctx.fillStyle,
            lineWidth: 1 // irrelevant for text
        };

        this.socket.emit('whiteboard:add-shape', {
            sessionId: this.sessionId,
            shape: shapePayload
        });

        // Add to history
        this.history.push({ type: 'shape', data: shapePayload });
    }

    // ==========================================
    // Selection, Cut, Copy, Paste, Resize Module
    // ==========================================

    initSelectionTools() {
        this.isSelectMode = false;
        this.selectionStart = null;
        this.selectionRect = null;
        this.selectionOverlay = null; // DOM element for selection box
        this.clipboard = null;
        
        // Bind events
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        
        // We need to intercept standard drawing if in select mode
        // The base class attaches listeners in setupDrawingListeners.
        // We can override those or add our own that stopPropagation if mode is select.
        // Actually, overriding setTool is cleaner.
    }
    
    // Override setTool to handle 'select'
    setTool(tool) {
        // Cleanup previous tools
        if (this.isTextToolActive) this.deactivateTextTool();
        if (this.isSelectMode) this.deactivateSelectTool();
        
        this.isEraserActive = (tool === 'eraser');
        this.isTextToolActive = (tool === 'text');
        this.isSelectMode = (tool === 'select');
        
        if (this.isEraserActive) {
             this.ctx.globalCompositeOperation = 'source-over'; 
             this.currentColor = '#ffffff'; 
             this.savedLineWidth = this.lineWidth; 
             this.setLineWidth(20); 
             super.setTool('pen'); 
        } else if (this.isTextToolActive) {
            super.setTool('text');
            this.canvas.style.cursor = 'text';
            this.activateTextTool();
        } else if (this.isSelectMode) {
             super.setTool('select'); // Base class just logs it
             this.canvas.style.cursor = 'crosshair';
             this.activateSelectTool();
        } else {
            // Normal Pen
            this.ctx.globalCompositeOperation = 'source-over';
            if (this.currentColor === '#ffffff') this.currentColor = '#000000';
            super.setTool(tool);
        }
        
        this.currentTool = tool;
    }

    activateSelectTool() {
        // We attach our own listeners that will act BEFORE base class if we use capture, 
        // OR we just rely on the fact that we set currentTool to 'select' and 
        // base class `startDrawing` checks `if (this.currentTool === 'select'?)`... No.
        // Base class `startDrawing` executes drawing logic immediately.
        // BUT we can override `startDrawing`, `draw`, `stopDrawing`.
    }

    deactivateSelectTool() {
        this.removeSelectionOverlay();
        this.selectionRect = null;
    }

    // Override Drawing Methods to Intercept Selection
    startDrawing(e) {
        if (this.isSelectMode) {
            this.isDrawing = true;
            const pos = this.getMousePos(e);
            this.selectionStart = pos;
            this.selectionRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
            
            // Create/Reset Overlay
            this.updateSelectionOverlay();
            return;
        }
        super.startDrawing(e);
    }

    draw(e) {
        if (this.isSelectMode && this.isDrawing) {
            const pos = this.getMousePos(e);
            this.selectionRect.w = pos.x - this.selectionStart.x;
            this.selectionRect.h = pos.y - this.selectionStart.y;
            this.updateSelectionOverlay();
            return;
        }
        super.draw(e);
    }

    stopDrawing() {
        if (this.isSelectMode && this.isDrawing) {
            this.isDrawing = false;
            if (Math.abs(this.selectionRect.w) > 5 && Math.abs(this.selectionRect.h) > 5) {
                this.showSelectionMenu();
            } else {
                this.removeSelectionOverlay();
            }
            return;
        }
        super.stopDrawing();
    }

    // Selection UI
    updateSelectionOverlay() {
        if (!this.selectionOverlay) {
            this.selectionOverlay = document.createElement('div');
            this.selectionOverlay.className = 'wb-selection-overlay';
            this.selectionOverlay.style.position = 'absolute';
            this.selectionOverlay.style.border = '2px dashed #007bff';
            this.selectionOverlay.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
            this.selectionOverlay.style.pointerEvents = 'none'; // Let clicks pass through if needed
            this.selectionOverlay.style.zIndex = '900';
            this.canvas.parentElement.appendChild(this.selectionOverlay);
        }

        const x = this.selectionRect.x + (this.selectionRect.w < 0 ? this.selectionRect.w : 0);
        const y = this.selectionRect.y + (this.selectionRect.h < 0 ? this.selectionRect.h : 0);
        const w = Math.abs(this.selectionRect.w);
        const h = Math.abs(this.selectionRect.h);

        this.selectionOverlay.style.left = (x + this.canvas.offsetLeft) + 'px';
        this.selectionOverlay.style.top = (y + this.canvas.offsetTop) + 'px';
        this.selectionOverlay.style.width = w + 'px';
        this.selectionOverlay.style.height = h + 'px';
    }

    removeSelectionOverlay() {
        if (this.selectionOverlay) {
            this.selectionOverlay.remove();
            this.selectionOverlay = null;
        }
        this.hideSelectionMenu();
    }

    showSelectionMenu() {
        // Show Cut/Copy/Cancel
        if (this.selectionMenu) this.selectionMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'glass-popover';
        menu.style.visibility = 'visible';
        menu.style.opacity = '1';
        menu.style.position = 'absolute';
        
        // Position near selection
        const r = this.selectionRect;
        const x = r.x + (r.w < 0 ? r.w : 0) + this.canvas.offsetLeft;
        const y = r.y + (r.h < 0 ? r.h : 0) + this.canvas.offsetTop + Math.abs(r.h) + 10;
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'flex';
        menu.style.gap = '8px';
        menu.style.zIndex = '2000';

        menu.innerHTML = `
            <button class="glass-btn" id="wb-cut" title="Cut"><i class="fa-solid fa-scissors"></i></button>
            <button class="glass-btn" id="wb-copy" title="Copy"><i class="fa-solid fa-copy"></i></button>
            <button class="glass-btn danger" id="wb-cancel-sel" title="Cancel"><i class="fa-solid fa-times"></i></button>
        `;

        this.canvas.parentElement.appendChild(menu);
        this.selectionMenu = menu;

        menu.querySelector('#wb-cut').addEventListener('click', () => this.performCut());
        menu.querySelector('#wb-copy').addEventListener('click', () => this.performCopy());
        menu.querySelector('#wb-cancel-sel').addEventListener('click', () => this.removeSelectionOverlay());
    }

    hideSelectionMenu() {
        if (this.selectionMenu) {
             this.selectionMenu.remove();
             this.selectionMenu = null;
        }
    }

    performCopy() {
        // Get ImageData
        const r = this.selectionRect;
        // Handle negative W/H
        const x = r.x + (r.w < 0 ? r.w : 0);
        const y = r.y + (r.h < 0 ? r.h : 0);
        const w = Math.abs(r.w);
        const h = Math.abs(r.h);

        const imgData = this.ctx.getImageData(x, y, w, h);
        this.clipboard = this.imageDataToDataURL(imgData);
        
        this.showNotification("Copied to local clipboard");
        this.removeSelectionOverlay();
    }

    performCut() {
        this.performCopy(); // Save first
        
        // Clear area
        const r = this.selectionRect;
        const x = r.x + (r.w < 0 ? r.w : 0);
        const y = r.y + (r.h < 0 ? r.h : 0);
        const w = Math.abs(r.w);
        const h = Math.abs(r.h);
        
        this.ctx.clearRect(x, y, w, h);
        
        // Sync Clear?
        // Current 'whiteboard_canvas.js' only supports 'clear' (whole canvas).
        // It does NOT support clearing a rect.
        // Workaround: Draw a white rectangle over it.
        // Assuming white background.
        
        const shapePayload = {
            type: 'rectangle',
            x: x, y: y, width: w, height: h,
            color: '#ffffff', // Paint white
            lineWidth: 1
        };
        // FILL it? 'rectangle' in base class uses `rect()` then `stroke()`. It is NOT filled.
        // The base class drawShape does `ctx.beginPath(); ctx.rect(...); ctx.stroke();`.
        // It does NOT support fill.
        // FLAW: We cannot erase a specific area cleanly with existing sync without fill support.
        
        // HACK: Draw many lines? No.
        // If we really want "Cut" to work for OTHERS, we need 'fill'.
        // Since we override `drawShape`, we can add a 'filledRectangle' type!
        
        const erasePayload = {
            type: 'filledRectangle',
            x: x, y: y, width: w, height: h,
            color: '#ffffff'
        };
        
        this.socket.emit('whiteboard:add-shape', {
            sessionId: this.sessionId,
            shape: erasePayload
        });
        
        // Execute locally
        this.drawShape(erasePayload);
    }

    imageDataToDataURL(imageData) {
        const c = document.createElement('canvas');
        c.width = imageData.width;
        c.height = imageData.height;
        c.getContext('2d').putImageData(imageData, 0, 0);
        return c.toDataURL();
    }

    // Paste Logic
    async pasteFromClipboard() {
        // 1. Try internal clipboard first
        if (this.clipboard) {
            this.createFloatingImage(this.clipboard);
            return;
        }

        // 2. Try System Clipboard (Images)
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                if (item.types && item.types.some(type => type.startsWith('image/'))) {
                     const blob = await item.getType(item.types.find(type => type.startsWith('image/')));
                     const reader = new FileReader();
                     reader.onload = (e) => this.createFloatingImage(e.target.result);
                     reader.readAsDataURL(blob);
                     return;
                }
            }
            this.showNotification("No image in clipboard.");
        } catch (err) {
            console.error(err);
             this.showNotification("Clipboard permission denied or empty.");
        }
    }
    
    handlePaste(e) {
        // Handle system clipboard paste (Ctrl+V)
        // Check for image data
        const clipboardData = e.clipboardData || e.originalEvent.clipboardData;
        const items = clipboardData.items;

        console.log("Paste detected:", items); // Debugging

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") === 0) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.createFloatingImage(event.target.result);
                };
                reader.readAsDataURL(blob);
                return; 
            }
        }
    }

    createFloatingImage(src) {
        // Create a draggable, resizable div with the image
        if (this.floatingImageConfig) this.cancelFloatingImage(); // Clear existing

        const wrapper = document.createElement('div');
        wrapper.className = 'wb-floating-image';
        wrapper.style.position = 'absolute';
        wrapper.style.left = 'center';
        wrapper.style.top = 'center';
        wrapper.style.border = '2px dashed #007bff';
        wrapper.style.cursor = 'move';
        wrapper.style.zIndex = '1000';
        wrapper.style.resize = 'both';
        wrapper.style.overflow = 'hidden';
        wrapper.style.width = '200px';
        wrapper.style.height = 'auto';
        wrapper.style.maxWidth = '500px';

        const img = document.createElement('img');
        img.src = src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.pointerEvents = 'none';
        
        wrapper.appendChild(img);
        
        // Add Controls (Stamp / Cancel)
        const controls = document.createElement('div');
        controls.style.position = 'absolute';
        controls.style.top = '-40px';
        controls.style.right = '0';
        controls.style.display = 'flex';
        controls.style.gap = '5px';
        
        controls.innerHTML = `
            <button class="glass-btn active" id="wb-stamp" title="Stamp"><i class="fa-solid fa-check"></i></button>
            <button class="glass-btn danger" id="wb-cancel-paste" title="Cancel"><i class="fa-solid fa-times"></i></button>
        `;
        
        wrapper.appendChild(controls);
        
        // Center it
        const cx = this.canvas.width / 2 - 100;
        const cy = this.canvas.height / 2 - 100;
        wrapper.style.left = (cx + this.canvas.offsetLeft) + 'px';
        wrapper.style.top = (cy + this.canvas.offsetTop) + 'px';

        this.canvas.parentElement.appendChild(wrapper);
        this.floatingImageConfig = { wrapper, img };

        // Draggable Logic
        let isDragging = false;
        let startX, startY;

        wrapper.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'I') return;
            isDragging = true;
            startX = e.clientX - wrapper.offsetLeft;
            startY = e.clientY - wrapper.offsetTop;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            wrapper.style.left = (e.clientX - startX) + 'px';
            wrapper.style.top = (e.clientY - startY) + 'px';
        });

        window.addEventListener('mouseup', () => { isDragging = false; });
        
        // Bind Buttons
        controls.querySelector('#wb-stamp').addEventListener('click', () => {
            this.stampFloatingImage();
        });
        controls.querySelector('#wb-cancel-paste').addEventListener('click', () => {
            this.cancelFloatingImage();
        });
    }
    
    cancelFloatingImage() {
        if (this.floatingImageConfig) {
            this.floatingImageConfig.wrapper.remove();
            this.floatingImageConfig = null;
        }
    }

    stampFloatingImage() {
        if (!this.floatingImageConfig) return;
        const { wrapper, img } = this.floatingImageConfig;
        
        const x = wrapper.offsetLeft - this.canvas.offsetLeft;
        const y = wrapper.offsetTop - this.canvas.offsetTop;
        const w = wrapper.clientWidth;
        const h = wrapper.clientHeight;
        
        // Draw Locally
        this.ctx.drawImage(img, x, y, w, h);
        
        // Emit
        const shapePayload = {
            type: 'image',
            x: x, y: y, width: w, height: h,
            src: img.src
        };

        this.socket.emit('whiteboard:add-shape', {
            sessionId: this.sessionId,
            shape: shapePayload
        });

        this.cancelFloatingImage();
    }

    // Override drawShape to support text AND images AND filledRectangle
    drawShape(shape) {
        if (shape.type === 'text') {
            this.ctx.font = '16px Inter, sans-serif';
            this.ctx.fillStyle = shape.color;
            this.ctx.fillText(shape.text, shape.x, shape.y);
        } else if (shape.type === 'image') {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
            };
            img.src = shape.src;
        } else if (shape.type === 'filledRectangle') {
            this.ctx.fillStyle = shape.color;
            this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        } else {
            super.drawShape(shape);
        }
    }

    // Download Feature
    downloadSnapshot() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `whiteboard-${this.sessionId}-${timestamp}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
    
    undo() {
        this.showNotification("⚠️ Undo not supported in this version locally.");
    }

}

// Clean up
window.EnhancedWhiteboard = EnhancedWhiteboard;
