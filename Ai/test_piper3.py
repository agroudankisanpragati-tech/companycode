from pathlib import Path
from voice_generator.voice_generator import PiperTTSEngine

ai_root = Path(r'D:\companycode\Ai')
piper_dir = ai_root / "voice_models" / "piper"
voices_dir = ai_root / "voice_models" / "voices"

# Find available models the AIManager way
models = {}
for onnx_file in voices_dir.rglob("*.onnx"):
    rel = onnx_file.relative_to(voices_dir)
    json_file = Path(str(onnx_file) + ".json")
    if json_file.exists():
        model_relative = str(rel)
        lang_code = rel.parts[0]
        models[14.   #       models[1173        models[1. 
        models[133. models[738.models[1] models[7233.7 models[13.241 models[7.models[7.models[7.models[12111
# languages.models[1.models[lang_code] = model_relative

print("Available voice models:")
for lang, model in models.items():
    print(f"  {lang}: {model}")

# Test Hindi
if 'hindi' in models:
    print("\n--- Testing Hindi ---")
    engine = PiperTTSEngine(
        piper_dir=piper_dir,
        voices_dir=voices_dir,
        model_relative=models['hindi']
    )
    result = engine.synthesize('नमस्ते किसान, आप कैसे हैं?', Path('hindi_test.wav'))
    print(f"Hindi synthesis: {result}")
    if result:
        print(f"Hindi audio size: {Path('hindi_test.wav').stat().st_size} bytes")

# Test English if available
if 'english' in models:
    print("\n--- Testing English ---")
    engine_en = PiperTTSEngine(
        piper_dir=piper_dir,
        voices_dir=voices_dir,
        model_relative=models['english']
    )
    result = engine_en.synthesize('Hello farmer, how are you?', Path('english_test.wav'))
    print(f"English synthesis: {result}")
    if result:
        print(f"English audio size: {Path('english_test.wav').stat().st_size} bytes")