/**
 * Whiteboard UI Manager
 * Handles the Glassmorphic Toolbar, Events, and UI State.
 */
class WhiteboardUI {
    constructor(whiteboardInstance) {
        this.wb = whiteboardInstance;
        this.container = document.getElementById('whiteboard__section');
        this.toolbar = null;
        
        this.initUI();
    }

    initUI() {
        // Hide existing toolbar (if any remaining from base HTML)
        const oldTools = document.querySelector('.wb-header-actions');
        if (oldTools) oldTools.style.display = 'none';

        // Create new Glassmorphic Toolbar
        this.createToolbar();
        
        // Bind Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.container.classList.contains('hidden')) return;
            
            if (e.key === 'p') this.selectTool('pen');
            if (e.key === 'e') this.selectTool('eraser');
            if (e.key === 't') this.selectTool('text');
        });
    }

    createToolbar() {
        // Remove existing if any
        const existing = document.getElementById('glass-toolbar');
        if (existing) existing.remove();

        const toolbar = document.createElement('div');
        toolbar.id = 'glass-toolbar';
        toolbar.className = 'glass-toolbar';
        toolbar.innerHTML = `
            <div class="glass-group">
                <button class="glass-btn active" data-tool="pen" title="Pencil (P)">
                    <i class="fa-solid fa-pencil"></i>
                </button>
                <div class="glass-popover-wrapper">
                     <button class="glass-btn" data-tool="eraser-menu" title="Eraser (E)">
                        <i class="fa-solid fa-eraser"></i>
                    </button>
                    <div class="glass-popover eraser-popover">
                        <div class="size-presets" id="eraser-presets">
                            <button class="size-btn" data-size="10" title="Small"><i class="fa-solid fa-circle" style="font-size: 8px;"></i></button>
                            <button class="size-btn active" data-size="30" title="Medium"><i class="fa-solid fa-circle" style="font-size: 16px;"></i></button>
                            <button class="size-btn" data-size="60" title="Large"><i class="fa-solid fa-circle" style="font-size: 24px;"></i></button>
                        </div>
                    </div>
                </div>
                <!-- Duplicate text button removed -->
                <button class="glass-btn" data-tool="text" title="Text (T)">
                    <i class="fa-solid fa-font"></i>
                </button>
            </div>
            
            <div class="glass-separator"></div>

             <div class="glass-group">
                <button class="glass-btn" data-tool="select" title="Select Area (S)">
                    <i class="fa-solid fa-vector-square"></i>
                </button>
                 <button class="glass-btn" id="glass-paste" title="Paste Image (Ctrl+V)">
                    <i class="fa-solid fa-paste"></i>
                </button>
            </div>
            
            <div class="glass-separator"></div>
            
            <div class="glass-group">
                <input type="color" id="glass-color-picker" value="#000000" title="Color">
                <div class="glass-popover-wrapper">
                    <button class="glass-btn" title="Line Size">
                         <i class="fa-solid fa-circle-dot"></i>
                    </button>
                    <div class="glass-popover size-popover">
                        <div class="size-presets" id="pen-presets">
                            <button class="size-btn active" data-size="2" title="Fine"><i class="fa-solid fa-circle" style="font-size: 6px;"></i></button>
                            <button class="size-btn" data-size="5" title="Thick"><i class="fa-solid fa-circle" style="font-size: 10px;"></i></button>
                            <button class="size-btn" data-size="10" title="Marker"><i class="fa-solid fa-circle" style="font-size: 14px;"></i></button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="glass-separator"></div>

            <div class="glass-group right">
                <button class="glass-btn" id="glass-download" title="Download Snapshot">
                    <i class="fa-solid fa-download"></i>
                </button>
                <button class="glass-btn danger" id="glass-clear" title="Clear Board (Faculty)">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <button class="glass-btn close-btn" id="glass-close" title="Close">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        this.container.appendChild(toolbar);
        this.toolbar = toolbar;
        
        this.bindEvents();
    }

    bindEvents() {
        // Tool Selection
        this.toolbar.querySelectorAll('[data-tool]').forEach(btn => {
            if (btn.dataset.tool === 'eraser-menu') return; // Handled specially
            
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                this.selectTool(tool);
            });
        });

        // Eraser Menu Logic
        const eraserBtn = this.toolbar.querySelector('[data-tool="eraser-menu"]');
        const eraserPresets = document.getElementById('eraser-presets');
        
        eraserBtn.addEventListener('click', (e) => {
            // Check if clicking inside presets to prevent tool switch if desired
            if (eraserPresets.contains(e.target)) return;
            this.selectTool('eraser');
        });

        // Eraser Size Presets
        eraserPresets.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling
                // UI update
                eraserPresets.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const size = parseInt(btn.dataset.size);
                if (this.wb.currentTool === 'eraser') {
                    this.wb.setLineWidth(size);
                }
                // Store logic for later restore could be added here
            });
        });
        
        // Color Picker
        const colorInput = document.getElementById('glass-color-picker');
        colorInput.addEventListener('input', (e) => {
            this.wb.setColor(e.target.value);
            // If Text tool active, update input color if exists
            if (this.wb.textInput) {
                this.wb.textInput.style.color = e.target.value;
                this.wb.textInput.focus();
            }
        });

        // Pen Size Presets
        const penPresets = document.getElementById('pen-presets');
        penPresets.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 // UI Update
                 penPresets.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                 btn.classList.add('active');

                 const size = parseInt(btn.dataset.size);
                 this.wb.setLineWidth(size);
                 
                 // Auto-switch to pen if eraser was active
                 if (this.wb.currentTool === 'eraser') {
                     this.selectTool('pen');
                 }
            });
        });


        // Download
        document.getElementById('glass-download').addEventListener('click', () => {
            this.wb.downloadSnapshot();
        });

        // Clear
        document.getElementById('glass-clear').addEventListener('click', () => {
             if (confirm('Clear the entire whiteboard?')) {
                 this.wb.clearCanvasAndNotify();
             }
        });
        
        // Paste
        document.getElementById('glass-paste').addEventListener('click', () => {
             this.wb.pasteFromClipboard();
        });

        // Toggle Select Tool
        // The loop above handles data-tool="select" automatically calling selectTool 
        // We just need to ensure selectTool handles it.
        
        // Listen for Keyboard Paste (Ctrl+V)
        document.addEventListener('paste', (e) => {
            if (this.container.classList.contains('hidden')) return;
            e.preventDefault();
            this.wb.handlePaste(e);
        });

        // Close
        document.getElementById('glass-close').addEventListener('click', () => {
            window.SessionManager.closeAllOverlays();
        });
    }

    selectTool(tool) {
        // Update UI
        this.toolbar.querySelectorAll('.glass-btn').forEach(b => b.classList.remove('active'));
        
        if (tool === 'pen') {
            this.toolbar.querySelector('[data-tool="pen"]').classList.add('active');
            // Restore pen size
            const activePreset = document.querySelector('#pen-presets .size-btn.active');
            const penSize = activePreset ? activePreset.dataset.size : 2;
             this.wb.setTool('pen');
             this.wb.setLineWidth(parseInt(penSize));
        } else if (tool === 'eraser') {
            this.toolbar.querySelector('[data-tool="eraser-menu"]').classList.add('active');
            // Apply eraser size
             const activePreset = document.querySelector('#eraser-presets .size-btn.active');
             const eraserSize = activePreset ? activePreset.dataset.size : 30;
             this.wb.setTool('eraser');
             this.wb.setLineWidth(parseInt(eraserSize));
        } else if (tool === 'text') {
            this.toolbar.querySelector('[data-tool="text"]').classList.add('active');
            this.wb.setTool('text');
        } else if (tool === 'select') {
             this.toolbar.querySelector('[data-tool="select"]').classList.add('active');
             this.wb.setTool('select');
        }
    }
}
