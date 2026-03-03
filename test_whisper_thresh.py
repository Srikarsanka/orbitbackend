import sys
import os
from faster_whisper import WhisperModel

tmp_audio = "test_audio_fixed.wav"

print(f"4. Transcribing with relaxed thresholds...")
model = WhisperModel("small", device="cpu", compute_type="int8")

# Relax thresholds to force output
segments_gen, info = model.transcribe(
    tmp_audio, 
    beam_size=5, 
    language=None, 
    vad_filter=False,
    no_speech_threshold=0.9,
    log_prob_threshold=-2.0,
    condition_on_previous_text=False
)
print(f"Detected language: {info.language}")

count = 0
for seg in segments_gen:
    count += 1
    print(f"[{seg.start:.2f}s -> {seg.end:.2f}s] {seg.text}")

print(f"Total segments: {count}")
