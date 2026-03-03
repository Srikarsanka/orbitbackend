import sys
import os
import subprocess
from faster_whisper import WhisperModel

tmp_video = "test_video.webm"
tmp_audio = "test_audio_fixed.wav"

print(f"2. Extracting audio with hardcore timestamp fixes...")
# -async 1: stretch/squeeze audio to match timestamps
# -af aresample=async=1: force resample
cmd = [
    "ffmpeg", "-y",
    "-err_detect", "ignore_err",
    "-i", tmp_video,
    "-vn", 
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "-af", "aresample=async=1:min_comp=0.001:min_hard_comp=0.100000",
    tmp_audio
]
subprocess.run(cmd, capture_output=True)
print(f"Audio extracted. Size: {os.path.getsize(tmp_audio)} bytes")

print(f"4. Transcribing...")
model = WhisperModel("small", device="cpu", compute_type="int8")
segments_gen, info = model.transcribe(tmp_audio, beam_size=5, language=None, vad_filter=False)
print(f"Detected language: {info.language}")

count = 0
for seg in segments_gen:
    count += 1
    print(f"[{seg.start:.2f}s -> {seg.end:.2f}s] {seg.text}")

print(f"Total segments: {count}")
