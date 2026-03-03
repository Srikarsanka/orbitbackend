import sys
import os
import subprocess
from faster_whisper import WhisperModel

tmp_video = "test_video.webm"
tmp_audio = "test_audio2.wav"

print(f"2. Extracting audio with timestamp fix...")
cmd = [
    "ffmpeg", "-y",
    "-err_detect", "ignore_err", # Ignore stream errors
    "-i", tmp_video,
    "-vn", 
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    tmp_audio
]
subprocess.run(cmd, capture_output=True)
print(f"Audio extracted. Size: {os.path.getsize(tmp_audio)} bytes")

print(f"4. Transcribing...")
model = WhisperModel("small", device="cpu", compute_type="int8")
segments_gen, info = model.transcribe(tmp_audio, beam_size=5, language=None, vad_filter=True)
print(f"Detected language: {info.language}")

count = 0
for seg in segments_gen:
    count += 1
    print(f"[{seg.start:.2f}s -> {seg.end:.2f}s] {seg.text}")

print(f"Total segments: {count}")
