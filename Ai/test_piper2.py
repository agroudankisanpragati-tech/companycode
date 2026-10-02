from pathlib import Path
from voice_generator.voice_generator import PiperTTSEngine

ai_root = Path(r'D:\companycode\Ai')
piper_dir = ai_root / "voice_models" / "piper"
voices_dir = ai_root / "voice_models" / "voices"

# Find available models
print("Searching for available models...")
models_found = []
for onnx_file in voices_dir.rglob("*.onnx"):
    rel = onnx_file.relative_to(voices_dir)
    json_file = Path(str(onnx_file) + ".json")
    if json_file.exists():
        model_relative = str(rel)
        lang_code = rel.parts[0]  # first folder name is language code
        models_found.append((lang_code, rel, json_file))
        
print(f"\nFound {len(models_found)} language models:")
for lang_code, rel, json_file in models_found:
    print(f"  {lang_code}: {rel}")

# Test Hindi
print("\n--- Testing Hindi ---")
if models_found:
    engine_hindi = PiperTTSEngine(
        piper_dir=piper_dir,
        voices_dir=voices_dir,
        model_relative=models_found[0][1]  # Hindi is first
    )
    result = engine_hindi.synthesize('नमस्ते किसान, आप कैसे हैं?', Path('test_hindi.wav'))
    print(f"Hindi result: {result}")
    if result:
        print(f"Hindi audio size: {Path('test_hindi.wav').stat().st_size} bytes")

# Test English - need to find English model
print("\n--- Testing English ---")
english_models = [m for m in models_found if m[0] == 'en']
if english_models:
    engine_en = PiperTTSEngine(
        piper_dir=piper_dir,
        voices_dir=voices_dir,
        model_relative=english_models[0][1]
    )
    result = engine_en.synthesize('Hello farmer, how are you?', Path('test_english.wav'))
    print(f"English result: {result}")
    if result:
        print(f"English audio size: {Path('test_english.wav').stat().st_size} bytes")
else:
    print("No English model found in current voices")
    print("Common English model: en_US-lessac-medium.onnx")