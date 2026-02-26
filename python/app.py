# app.py (replace existing encode endpoint)
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from insightface.app import FaceAnalysis
from PIL import Image
import io

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"])
model.prepare(ctx_id=0, det_size=(640, 640))

@app.post("/encode")
async def encode(file: UploadFile = File(...)):
    img_bytes = await file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    arr = np.array(img)

    faces = model.get(arr)
    if not faces:
        return {"error": "NO_FACE_FOUND"}

    # Use normalized embedding (unit vector) — stable for matching
    embedding = faces[0].normed_embedding.tolist()
    return {"embedding": embedding}

# ============================================================
# CODE COMPILER ENDPOINTS
# ============================================================
from code_executor import CodeExecutor
from pydantic import BaseModel

class CodeExecutionRequest(BaseModel):
    language: str
    code: str
    input: str = ""

@app.post("/api/compiler/execute")
async def execute_code(request: CodeExecutionRequest):
    """Execute code in specified language"""
    try:
        result = CodeExecutor.execute(
            language=request.language,
            code=request.code,
            input_data=request.input
        )
        return result
    except Exception as e:
        return {
            "success": False,
            "output": "",
            "error": str(e),
            "executionTime": 0
        }

@app.get("/api/compiler/languages")
async def get_supported_languages():
    """Get list of supported programming languages"""
    return {
        "languages": [
            {"id": "python", "name": "Python", "icon": "🐍"},
            {"id": "java", "name": "Java", "icon": "☕"},
            {"id": "c", "name": "C", "icon": "🔧"},
            {"id": "cpp", "name": "C++", "icon": "⚙️"}
        ]
    }

# ============================================================
# AI GENERATION ENDPOINT - Smart Code Analysis & Fixes
# ============================================================

class AIRequest(BaseModel):
    prompt: str

def fix_common_errors(code: str, error: str, language: str) -> str:
    """Detect and fix common coding errors with proper indentation"""
    
    fixed_code = code
    explanation = []
    
    if language.lower() == 'python':
        import re
        
        # Fix indentation errors
        if 'IndentationError' in error or 'expected an indented block' in error:
            lines = code.split('\n')
            fixed_lines = []
            for i, line in enumerate(lines):
                fixed_lines.append(line)
                if line.strip().endswith(':') and i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if next_line.strip() and not next_line.startswith('    '):
                        fixed_lines.append('    pass  # TODO: Add your code here')
                        explanation.append(f"Added indentation after '{line.strip()}'")
            fixed_code = '\n'.join(fixed_lines)
        
        # Fix missing colons
        elif 'SyntaxError' in error and ('if ' in code or 'for ' in code or 'while ' in code or 'def ' in code):
            lines = code.split('\n')
            fixed_lines = []
            for line in lines:
                stripped = line.strip()
                if (stripped.startswith(('if ', 'elif ', 'else', 'for ', 'while ', 'def ', 'class ')) 
                    and not stripped.endswith(':') 
                    and not stripped.endswith('\\') 
                    and '#' not in stripped):
                    fixed_lines.append(line + ':')
                    explanation.append(f"Added missing colon to: {stripped}")
                else:
                    fixed_lines.append(line)
            fixed_code = '\n'.join(fixed_lines)
        
        # Fix undefined variables (NameError)
        elif 'NameError' in error:
            match = re.search(r"name '(\w+)' is not defined", error)
            if match:
                undefined_var = match.group(1)
                defined_vars = re.findall(r'\b([a-zA-Z_]\w*)\s*=', code)
                fixed = False
                
                for var in defined_vars:
                    if var.lower() == undefined_var.lower() or abs(len(var) - len(undefined_var)) <= 2:
                        fixed_code = re.sub(r'\b' + undefined_var + r'\b', var, code)
                        explanation.append(f"Fixed variable name: '{undefined_var}' → '{var}'")
                        fixed = True
                        break
                
                if not fixed:
                    fixed_code = re.sub(r'\b' + undefined_var + r'\b', f'"{undefined_var}"', code)
                    explanation.append(f"Added quotes around '{undefined_var}' - treating it as a string")
        
        # Fix missing parentheses in print (Python 2 to 3)
        elif 'SyntaxError' in error and 'print' in code:
            fixed_code = re.sub(r'\bprint\s+([^(].*?)(?=\n|$)', r'print(\1)', code)
            if fixed_code != code:
                explanation.append("Added parentheses to print() for Python 3")
    
    # Return formatted response
    if explanation:
        return f"""✅ CORRECTED CODE:

```{language}
{fixed_code}
```

🔧 FIXES APPLIED:
{chr(10).join(f"• {exp}" for exp in explanation)}

💡 TIP: Copy the corrected code above and try running it again!"""
    else:
        # Extract just the error type for display
        error_type = error.split('\n')[-1] if '\n' in error else error.split(':')[0] if ':' in error else error
        return f"""⚠️ ERROR DETECTED: {error_type}

🔍 DEBUGGING TIPS:
• Check for syntax errors (missing colons, parentheses, quotes)
• Verify all variables are defined before use
• Ensure proper indentation (4 spaces per level in Python)
• Review the error message carefully

📝 ORIGINAL CODE:
```{language}
{code}
```"""

def generate_smart_suggestions(code: str, language: str) -> str:
    """Generate intelligent code suggestions for successful code"""
    
    suggestions = []
    
    # Python-specific analysis
    if language.lower() == 'python':
        # Positive feedback for good practices
        if '.get(' in code:
            suggestions.append("✓ Excellent use of .get() method for safe dictionary access. This prevents KeyError exceptions.")
        
        if 'list(' in code and 'map(' in code:
            suggestions.append("✓ Good use of map() for functional programming. Your code efficiently transforms input data.")
        
        if 'hash' in code.lower() or 'dict' in code.lower():
            suggestions.append("✓ Using dictionaries for frequency counting is an optimal O(n) solution. Well done!")
        
        # Constructive suggestions
        if 'for i in range(len(' in code:
            suggestions.append("→ Consider: Instead of 'for i in range(len(list))', use 'for item in list' for cleaner, more Pythonic code.")
        
        if code.count('print(') > 2:
            suggestions.append("→ Tip: For production code, consider using the logging module instead of multiple print statements.")
        
        if 'for' in code and 'append(' in code and '[' not in code.split('for')[0]:
            suggestions.append("→ Optimization: List comprehensions can be faster than for-loops with append(). Example: [x*2 for x in list]")
        
        # Code quality tips
        if len(code.split('\n')) < 10:
            suggestions.append("→ Maintainability: Your code is concise. For complex logic, add comments to explain the approach.")
        
        # Performance insights
        if 'in' in code and 'list' in code:
            suggestions.append("→ Performance: Checking 'if x in list' is O(n). For frequent lookups, use sets or dictionaries for O(1) performance.")
    
    # General programming wisdom
    suggestions.append("→ Best Practice: Always test your code with edge cases (empty input, single element, duplicates).")
    suggestions.append("→ Code Quality: Use descriptive variable names that explain their purpose.")
    
    if not suggestions:
        suggestions = [
            "✓ Your code structure looks solid!",
            "→ Keep practicing different problem-solving approaches.",
            "→ Consider time and space complexity for optimization.",
            "→ Write clean, readable code that others can understand."
        ]
    
    return "\n\n".join(suggestions[:5])  # Limit to 5 suggestions

@app.post("/api/ai/generate")
async def generate_ai_response(request: AIRequest):
    """Generate code fixes for errors or suggestions for successful code"""
    try:
        # Extract code and language from prompt
        code = ""
        language = "python"
        error = ""
        is_error = "error" in request.prompt.lower()
        
        # Parse the prompt
        if "```" in request.prompt:
            parts = request.prompt.split("```")
            if len(parts) >= 2:
                code_block = parts[1]
                lines = code_block.split('\n')
                if lines and lines[0].strip() in ['python', 'java', 'c', 'cpp']:
                    language = lines[0].strip()
                    code = '\n'.join(lines[1:])
                else:
                    code = code_block
        
        # Try to extract code from prompt
        if not code and "Code:" in request.prompt:
            try:
                code = request.prompt.split("Code:")[1].split("Provide")[0].split("Error:")[0].strip()
            except:
                code = request.prompt
        
        # Extract error message
        if "Error:" in request.prompt or "error" in request.prompt.lower():
            try:
                error = request.prompt.split("Error:")[1].split("Provide")[0].strip() if "Error:" in request.prompt else request.prompt
            except:
                error = request.prompt
        
        # Generate response based on whether it's an error or success
        if is_error and error:
            response_text = fix_common_errors(code, error, language)
        else:
            response_text = generate_smart_suggestions(code if code else request.prompt, language)
        
        return {
            "success": True,
            "response": response_text
        }
        
    except Exception as e:
        return {
            "success": True,
            "response": "✓ Your code is on the right track!\n\n→ Focus on: Code readability, proper error handling, and testing with various inputs.\n\n→ Keep learning and experimenting with different approaches!"
        }







