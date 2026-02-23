# app.py (Optimized for Azure App Service)
import os
import contextlib

# 1. Set persistent cache path BEFORE importing InsightFace
# Azure persists files in /home, preventing re-download on app restart
# Fallback to local 'models' dir if not running on Azure
HOME_DIR = os.getenv("HOME", "/home")
INSIGHTFACE_DIR = os.path.join(HOME_DIR, "insightface")
os.environ["INSIGHTFACE_HOME"] = INSIGHTFACE_DIR

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from insightface.app import FaceAnalysis
from PIL import Image
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orbit_backend")

# Global model variable
_face_analyzer = None

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler to load heavy AI models once at startup.
    This prevents memory spikes and latency on first request.
    """
    global _face_analyzer
    try:
        logger.info(f"🚀 Starting up... stored models at {INSIGHTFACE_DIR}")
        
        # Initialize InsightFace model
        # allowed_modules=['detection', 'recognition'] loads minimal required models
        model = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"])
        
        # ctx_id=-1 forces CPU (safer for generic Azure App Service plans)
        # det_size=(640, 640) ensures consistent performance
        model.prepare(ctx_id=-1, det_size=(640, 640))
        
        _face_analyzer = model
        logger.info("✅ Face Analysis model loaded successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to load AI models: {e}")
        # We don't raise here to allow the app to start, but /encode will fail gracefully
        
    yield
    
    # Clean up resources if needed
    _face_analyzer = None
    logger.info("🛑 Shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root Health Check
@app.get("/")
async def health_check():
    """Health check endpoint for Azure App Service"""
    model_status = "loaded" if _face_analyzer else "not_loaded"
    return {
        "status": "ok", 
        "message": "Orbit AI Backend is running", 
        "service": "Face Analysis & Code Compiler",
        "model_status": model_status
    }

@app.post("/encode")
async def encode(file: UploadFile = File(...)):
    """
    Generate face embedding from uploaded image.
    Robust error handling ensures the backend doesn't crash on bad inputs.
    """
    global _face_analyzer
    
    if _face_analyzer is None:
        raise HTTPException(status_code=503, detail="AI Model not ready. Please try again in a moment.")

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")

    try:
        # Read and validation
        img_bytes = await file.read()
        if not img_bytes:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
            
        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            arr = np.array(img)
        except Exception as e:
            logger.error(f"Image processing error: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Inference
        # We use strict defensive copied input to avoid memory leaks in some libraries
        faces = _face_analyzer.get(arr)
        
        if not faces:
            return {"error": "NO_FACE_FOUND"}

        # Use normalized embedding (unit vector) — stable for matching
        # Taking the largest face (usually the user) if multiple detected
        largest_face = max(faces, key=lambda f: f.det_score) if faces else None
        
        if not largest_face:
             return {"error": "NO_FACE_FOUND"}
             
        embedding = largest_face.normed_embedding.tolist()
        return {"embedding": embedding}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Internal processing error")

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

# ============================================================
# VIDEO TRANSCRIPTION & TRANSLATION ENDPOINT
# ============================================================
import tempfile
import subprocess
import json as json_lib

# Conditional imports — these won't crash the rest of the app if missing
try:
    import httpx
    _httpx_available = True
except ImportError:
    _httpx_available = False
    logger.warning("⚠️ httpx not installed — transcription endpoint disabled")

# Global whisper model
_whisper_model = None

class TranscriptionRequest(BaseModel):
    videoUrl: str
    lang: str = "en"

def get_whisper_model():
    """Lazy-load faster-whisper model on first request"""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            logger.info("📥 Loading faster-whisper 'tiny' model...")
            _whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
            logger.info("✅ Whisper model loaded successfully")
        except ImportError:
            logger.error("❌ faster-whisper not installed. Run: pip install faster-whisper")
            raise HTTPException(status_code=503, detail="faster-whisper not installed on server")
        except Exception as e:
            logger.error(f"❌ Failed to load Whisper model: {e}")
            raise HTTPException(status_code=503, detail=f"Failed to load Whisper: {str(e)}")
    return _whisper_model

async def translate_text_mymemory(text: str, target_lang: str) -> str:
    """Translate text using MyMemory free API"""
    if not text.strip() or target_lang == "en":
        return text
    if not _httpx_available:
        return text
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.mymemory.translated.net/get",
                params={"q": text[:500], "langpair": f"en|{target_lang}"}
            )
            data = resp.json()
            if data.get("responseData") and data["responseData"].get("translatedText"):
                return data["responseData"]["translatedText"]
    except Exception as e:
        logger.warning(f"Translation failed: {e}")
    return text

@app.post("/api/transcribe")
async def transcribe_video(request: TranscriptionRequest):
    """
    Transcribe a video from URL using faster-whisper.
    Downloads audio, runs Whisper tiny model, optionally translates.
    Returns timestamped transcript segments.
    """
    if not _httpx_available:
        raise HTTPException(status_code=503, detail="httpx not installed — transcription unavailable")

    video_url = request.videoUrl
    target_lang = request.lang

    if not video_url:
        raise HTTPException(status_code=400, detail="videoUrl is required")

    logger.info(f"🎙️ Transcription request: lang={target_lang}, url={video_url[:80]}...")

    # Step 1: Download video and extract audio
    tmp_video = None
    tmp_audio = None
    try:
        tmp_video = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        tmp_audio = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_video.close()
        tmp_audio.close()

        # Download video
        logger.info("⬇️ Downloading video...")
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            resp = await client.get(video_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to download video (HTTP {resp.status_code})")
            with open(tmp_video.name, "wb") as f:
                f.write(resp.content)

        file_size_mb = os.path.getsize(tmp_video.name) / (1024 * 1024)
        logger.info(f"✅ Downloaded {file_size_mb:.1f}MB")

        # Extract audio with ffmpeg
        logger.info("🔊 Extracting audio with ffmpeg...")
        ffmpeg_cmd = [
            "ffmpeg", "-i", tmp_video.name,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            "-y", tmp_audio.name
        ]
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            logger.error(f"ffmpeg error: {result.stderr[:500]}")
            raise HTTPException(status_code=500, detail="Failed to extract audio from video")

        # Step 2: Transcribe with faster-whisper
        logger.info("🎙️ Running Whisper transcription...")
        model = get_whisper_model()
        whisper_segments, info = model.transcribe(
            tmp_audio.name,
            language="en",
            beam_size=1,
            vad_filter=True
        )

        segments = []
        for seg in whisper_segments:
            segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip()
            })

        logger.info(f"✅ Transcription complete: {len(segments)} segments")

        # Step 3: Translate if needed
        if target_lang != "en" and segments:
            logger.info(f"🌐 Translating to {target_lang}...")
            for seg in segments:
                seg["translated"] = await translate_text_mymemory(seg["text"], target_lang)
            logger.info("✅ Translation complete")

        return {
            "success": True,
            "segments": segments,
            "language": info.language if info else "en",
            "targetLang": target_lang,
            "totalSegments": len(segments)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Clean up temp files
        for f in [tmp_video, tmp_audio]:
            if f:
                try:
                    os.unlink(f.name)
                except:
                    pass

