import sys
import os
from faster_whisper import WhisperModel

tmp_video = "test_video.webm"

print(f"4. Transcribing WebM directly...")
model = WhisperModel("small", device="cpu", compute_type="int8")
segments_gen, info = model.transcribe(tmp_video, beam_size=5, language=None, vad_filter=True)
print(f"Detected language: {info.language}")

count = 0
for seg in segments_gen:
    count += 1
    print(f"[{seg.start:.2f}s -> {seg.end:.2f}s] {seg.text}")

print(f"Total segments: {count}")
