# face_encode.py
import base64
import importlib
# import face_recognition dynamically to avoid static import resolution errors in editors/linters
try:
    face_recognition = importlib.import_module("face_recognition")
except Exception:
    face_recognition = None
try:
    # import numpy dynamically to avoid static import resolution errors in editors/linters
    numpy = importlib.import_module("numpy")
    np = numpy
except Exception:
    np = None
from io import BytesIO
try:
    # import PIL.Image dynamically to avoid static import resolution errors in editors/linters
    Image = importlib.import_module("PIL.Image")
except Exception:
    Image = None
import sys
import json

try:
    # Read and parse input
    data = json.loads(sys.stdin.read())
    img_data = data.get("image")

    if not img_data:
        raise ValueError("No image data provided")

    # Strip base64 header if present
    if "," in img_data:
        img_data = img_data.split(",")[1]

    # Decode the base64 image and convert to a numpy array
    img_bytes = base64.b64decode(img_data)
    image = Image.open(BytesIO(img_bytes)).convert("RGB")

    if np is None:
        raise ImportError("numpy is not installed. Install with: pip install numpy")
    img_array = np.array(image)

    # Ensure face_recognition is available
    if face_recognition is None:
        raise ImportError("face_recognition module not installed. Install with: pip install face_recognition")

    # Get face encodings
    encodings = face_recognition.face_encodings(img_array)
    if len(encodings) == 0:
        print(json.dumps({"error": "No face detected"}))
    else:
        print(json.dumps({"embedding": encodings[0].tolist()}))

except Exception as e:
    print(json.dumps({"error": str(e)}))