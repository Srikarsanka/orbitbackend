/* ===================================
   ENHANCED COMPILER WITH AI ANALYSIS
   For Video Call Application
   =================================== */

// API Configuration - Render Backend (Now Local for Testing)
const API_BASE_URL = 'https://orbitbackend-0i66.onrender.com/api';

// Language file extensions mapping
const LANGUAGE_EXTENSIONS = {
    'javascript': 'js',
    'python': 'py',
    'c': 'c',
    'cpp': 'cpp',
    'java': 'java'
};

// Default code templates
const DEFAULT_CODE = {
    javascript: `// JavaScript Example - Fibonacci Series
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n-1) + fibonacci(n-2);
}

// Print first 10 Fibonacci numbers
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,
    python: `# Python Example - Fibonacci Series
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Print first 10 Fibonacci numbers
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")`,
    c: `// C Example - Fibonacci Series
#include <stdio.h>

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n-1) + fibonacci(n-2);
}

int main() {
    // Print first 10 Fibonacci numbers
    for (int i = 0; i < 10; i++) {
        printf("F(%d) = %d\\n", i, fibonacci(i));
    }
    return 0;
}`,
    cpp: `// C++ Example - Fibonacci Series
#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n-1) + fibonacci(n-2);
}

int main() {
    // Print first 10 Fibonacci numbers
    for (int i = 0; i < 10; i++) {
        cout << "F(" << i << ") = " << fibonacci(i) << endl;
    }
    return 0;
}`,
    java: `// Java Example - Fibonacci Series
public class Main {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n-1) + fibonacci(n-2);
    }
    
    public static void main(String[] args) {
        // Print first 10 Fibonacci numbers
        for (int i = 0; i < 10; i++) {
            System.out.println("F(" + i + ") = " + fibonacci(i));
        }
    }
}`
};

// Initialize enhanced compiler features
function initEnhancedCompiler() {
    const languageSelect = document.getElementById('language-select');
    const codeEditor = document.getElementById('codeplace');
    const runBtn = document.getElementById('run-btn');
    const analyzeBtn = document.getElementById('comp-analyze-ai');
    const clearOutputBtn = document.getElementById('clear-output');
    const copyOutputBtn = document.getElementById('copy-output');
    const toggleAIPanel = document.getElementById('toggle-ai-panel');
    const applyOptimalCode = document.getElementById('apply-optimal-code');
    
    // Language change handler
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            const language = e.target.value;
            const fileExt = LANGUAGE_EXTENSIONS[language];
            const fileName = `main.${fileExt}`;
            
            // Update file name display
            const currentFile = document.getElementById('current-file');
            const editorTab = document.getElementById('editor-tab');
            if (currentFile) currentFile.textContent = fileName;
            if (editorTab) editorTab.textContent = fileName;
            
            // Update CodeMirror mode if editor exists
            if (window.editor && window.editor.setOption) {
                const modeMap = {
                    'javascript': 'javascript',
                    'python': 'python',
                    'c': 'text/x-csrc',
                    'cpp': 'text/x-c++src',
                    'java': 'text/x-java'
                };
                window.editor.setOption('mode', modeMap[language] || 'python');
            }
            
            // Load default code for language
            if (DEFAULT_CODE[language]) {
                if (window.editor && window.editor.setValue) {
                    window.editor.setValue(DEFAULT_CODE[language]);
                } else {
                    const codeEditor = document.getElementById('codeplace');
                    if (codeEditor) codeEditor.value = DEFAULT_CODE[language];
                }
            }
            
            showNotification(`Switched to ${language}`, 'info');
        });
    }
    
    // Run code handler
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            await executeCode();
        });
    }
    
    // AI Analysis handler
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            await analyzeCodeWithAI();
        });
    }
    
    // Clear output
    if (clearOutputBtn) {
        clearOutputBtn.addEventListener('click', () => {
            const outputText = document.getElementById('output-text');
            if (outputText) {
                outputText.innerHTML = '$ Ready to execute...';
            }
        });
    }
    
    // Copy output
    if (copyOutputBtn) {
        copyOutputBtn.addEventListener('click', () => {
            const outputText = document.getElementById('output-text');
            if (outputText) {
                const text = outputText.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    showNotification('Output copied to clipboard', 'success');
                });
            }
        });
    }
    
    // Toggle AI panel
    if (toggleAIPanel) {
        toggleAIPanel.addEventListener('click', () => {
            const aiPanel = document.getElementById('ai-panel');
            if (aiPanel) {
                aiPanel.classList.toggle('collapsed');
            }
        });
    }
    
    // Apply optimal code
    if (applyOptimalCode) {
        applyOptimalCode.addEventListener('click', () => {
            const optimalCode = document.getElementById('ai-optimal-code');
            if (optimalCode && codeEditor) {
                codeEditor.value = optimalCode.textContent;
                showNotification('Optimized code applied', 'success');
            }
        });
    }
}

// Execute code function
async function executeCode() {
    const languageSelect = document.getElementById('language-select');
    const outputText = document.getElementById('output-text');
    const execTime = document.getElementById('exec-time');
    const runBtn = document.getElementById('run-btn');
    
    if (!languageSelect || !outputText) return;
    
    // Get code from CodeMirror editor if available, otherwise from textarea
    let code;
    if (window.editor && window.editor.getValue) {
        code = window.editor.getValue();
    } else {
        const codeEditor = document.getElementById('codeplace');
        if (!codeEditor) return;
        code = codeEditor.value;
    }
    
    const language = languageSelect.value;
    
    if (!code.trim()) {
        outputText.innerHTML = '<span style="color: #FF6B6B;">Error: No code to execute</span>';
        return;
    }
    
    // Show loading state
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running...';
    outputText.innerHTML = '$ Executing code...';
    
    const startTime = Date.now();
    
    try {
        const response = await fetch(`${API_BASE_URL}/compile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                language,
                code,
                input: ''
            })
        });
        
        const result = await response.json();
        const executionTime = Date.now() - startTime;
        
        // Display execution time
        if (execTime) {
            execTime.textContent = `${executionTime}ms`;
        }
        
        // Display output
        if (result.success) {
            const output = result.output || 'No output';
            outputText.innerHTML = `<span style="color: #4EC9B0;">${escapeHtml(output)}</span>`;
            
            if (result.error) {
                outputText.innerHTML += `\n<span style="color: #FF6B6B;">Warning: ${escapeHtml(result.error)}</span>`;
            }
        } else {
            outputText.innerHTML = `<span style="color: #FF6B6B;">Error: ${escapeHtml(result.error || 'Execution failed')}</span>`;
        }
        
    } catch (error) {
        outputText.innerHTML = `<span style="color: #FF6B6B;">Error: ${escapeHtml(error.message)}</span>`;
        console.error('Execution error:', error);
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Code';
    }
}

// Analyze code with AI
async function analyzeCodeWithAI() {
    const languageSelect = document.getElementById('language-select');
    const analyzeBtn = document.getElementById('comp-analyze-ai');
    const aiResults = document.getElementById('ai-results');
    const aiPlaceholder = document.querySelector('.ai-placeholder');
    const aiContent = document.getElementById('ai-content');
    
    if (!languageSelect) return;
    
    // Get code from CodeMirror editor if available, otherwise from textarea
    let code;
    if (window.editor && window.editor.getValue) {
        code = window.editor.getValue();
    } else {
        const codeEditor = document.getElementById('codeplace');
        if (!codeEditor) return;
        code = codeEditor.value;
    }
    
    const language = languageSelect.value;
    
    if (!code.trim()) {
        showNotification('Please write some code first', 'error');
        return;
    }
    
    // Show loading state
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
    
    if (aiPlaceholder) aiPlaceholder.style.display = 'none';
    if (aiResults) aiResults.style.display = 'none';
    
    aiContent.innerHTML = `
        <div class="ai-loading">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #667eea;"></i>
            <p style="margin-top: 12px;">AI is analyzing your code...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_BASE_URL}/analyze-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                language
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.analysis) {
            displayAIAnalysis(result.analysis);
        } else {
            throw new Error(result.error || 'Analysis failed');
        }
        
    } catch (error) {
        aiContent.innerHTML = `
            <div class="ai-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                AI analysis failed: ${escapeHtml(error.message)}
            </div>
        `;
        console.error('AI Analysis error:', error);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fa-solid fa-brain"></i> Analyze';
    }
}

// Display AI analysis results
function displayAIAnalysis(analysis) {
    const aiContent = document.getElementById('ai-content');
    const aiResults = document.getElementById('ai-results');
    
    if (!aiResults) return;
    
    // Update complexity displays
    const timeComplexity = document.getElementById('ai-time-complexity');
    const spaceComplexity = document.getElementById('ai-space-complexity');
    const optimizations = document.getElementById('ai-optimizations');
    const suggestions = document.getElementById('ai-suggestions');
    const optimalCode = document.getElementById('ai-optimal-code');
    const optimalCodeSection = document.getElementById('ai-optimal-code-section');
    
    if (timeComplexity) {
        timeComplexity.textContent = analysis.timeComplexity || 'Not analyzed';
    }
    
    if (spaceComplexity) {
        spaceComplexity.textContent = analysis.spaceComplexity || 'Not analyzed';
    }
    
    // Display optimizations
    if (optimizations && analysis.optimizations) {
        optimizations.innerHTML = '';
        analysis.optimizations.forEach(opt => {
            const li = document.createElement('li');
            li.textContent = opt;
            optimizations.appendChild(li);
        });
    }
    
    // Display suggestions
    if (suggestions && analysis.suggestions) {
        suggestions.innerHTML = '';
        analysis.suggestions.forEach(sug => {
            const li = document.createElement('li');
            li.textContent = sug;
            suggestions.appendChild(li);
        });
    }
    
    // Display optimal code if available
    if (optimalCode && analysis.optimalCode && analysis.optimalCode !== analysis.code) {
        optimalCode.textContent = analysis.optimalCode;
        if (optimalCodeSection) {
            optimalCodeSection.style.display = 'block';
        }
    } else {
        if (optimalCodeSection) {
            optimalCodeSection.style.display = 'none';
        }
    }
    
    // Show results
    aiContent.innerHTML = '';
    aiContent.appendChild(aiResults);
    aiResults.style.display = 'block';
    
    showNotification('AI analysis complete', 'success');
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Show notification
function showNotification(message, type = 'info') {
    // You can integrate this with your existing toast notification system
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // If you have a toast system, use it here
    if (typeof showToast === 'function') {
        showToast(message, type);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initEnhancedCompiler();
    console.log('✅ Enhanced Compiler with AI Analysis initialized');
});

// Export functions for external use
window.executeCode = executeCode;
window.analyzeCodeWithAI = analyzeCodeWithAI;
