from pathlib import Path
from voice_generator.voice_generator import PiperTTSEngine

ai_root = Path(r'D:\companycode\Ai')
piper_dir = ai_root / "voice_models" / "piper"
voices_dir = ai_root / "voice_models" / "voices"

# Test Hindi (already confirmed working)
print("--- Testing Hindi ---")
engine = PiperTTSEngine(
    piper_dir=piper_dir,
    voices_dir=voices_dir,
    model_relative=r'hindi\hi_IN-pratham-medium.onnx'
)
result = engine.synthesize('नमस्ते किसान, आप कैसे हैं?', Path('hindi_test.wav'))
print(f"Hindi synthesis: {result}")
if result:
    print(f"Hindi audio size: {Path('hindi_test.wav').stat().st_size} bytes")
    print("✓ Hindi TTS is WORKING through the pipeline")