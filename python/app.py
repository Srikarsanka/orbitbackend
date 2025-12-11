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
