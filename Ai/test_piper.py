from pathlib import Path
from voice_generator.voice_generator import PiperTTSEngine

# Use the same approach as AIManager._load_tts()
ai_root = Path(r'D:\companycode\Ai')
piper_dir = ai_root / "voice_models" / "piper"
voices_dir = ai_root / "voice_models" / "voices"

print("piper_dir exists:", piper_dir.exists())
print("voices_dir exists:", voices_dir.exists())

if voices_dir.exists():
    # Find the model the same way AIManager does
    model_relative = None
    for onnx_file in voices_dir.rglob("*.onnx"):
        rel = onnx_file.relative_to(voices_dir)
        json_file = Path(str(onnx_file) + ".json")
        if json_file.exists():
            model_relative = str(rel)
            print("Found model relative:", model_relative)
            break
    
    if model_relative:
        print("Creating engine with model_relative:", model_relative)
        engine = PiperTTSEngine(
            piper_dir=piper_dir,
            voices_dir=voices_dir,
            model_relative=model_relative
        )
        print('Engine created successfully')
        
        result = engine.synthesize('नमस्ते किसान, आप कैसे हैं?', Path('test_output.wav'))
        print('Synthesis result:', result)
        if result:
            output_file = Path('test_output.wav')
            print('Output file exists:', output_file.exists())
            print('Output file size:', output_file.stat().st_size, 'bytes')
    else:
        print("No suitable model found")
else:
    print("voices_dir not found")