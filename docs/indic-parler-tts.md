# Local Indic Parler-TTS setup

The chatbot can use AI4Bharat's Indic Parler-TTS through the existing Pragati AI
bridge on port 8001. It does not add another server. If the model or dependencies
are unavailable, the frontend falls back to the browser's speech synthesis.

## Isolate Parler from the main AI environment

1. Sign in to Hugging Face and accept the access conditions for
   `ai4bharat/indic-parler-tts`:
   https://huggingface.co/ai4bharat/indic-parler-tts
2. In PowerShell, create a dedicated Parler environment from the `Ai` folder.
   This keeps Parler's `descript-audiotools` protobuf pin separate from the
   Google and OpenTelemetry packages in `Ai/ml`:

   ```powershell
   cd D:\companycode\Ai
   python.exe -m venv .\parler_tts_env
   .\parler_tts_env\Scripts\python.exe -m pip install --upgrade pip
   .\parler_tts_env\Scripts\python.exe -m pip install -r .\requirements-indic-parler.txt
   .\parler_tts_env\Scripts\hf.exe auth login
   ```

   Paste a Hugging Face read token when prompted. The model downloads on the
   first synthesis request and is cached by Hugging Face. Keep the token private.
   The bridge starts one persistent inference worker from this environment, so
   it loads the model once and reuses it across replies.

3. Restore the main AI environment versions that Parler's shared-environment
   install changed. Run these from the `Ai` folder:

   ```powershell
   .\ml\Scripts\python.exe -m pip uninstall -y parler-tts descript-audio-codec descript-audiotools
   .\ml\Scripts\python.exe -m pip install "transformers==5.17.0" "huggingface_hub==1.16.1" "tokenizers==0.23.2" "protobuf==7.36.2"
   .\ml\Scripts\python.exe -m pip check
   ```

   The final command should report `No broken requirements found.` The dedicated
   Parler environment is not included in that check.

## Enable the chatbot voice

Add these settings to the existing backend `.env`:

```env
VOICE_TTS_PROVIDER=local
LOCAL_TTS_ENDPOINT=http://localhost:8001/tts
```

Add this setting to the frontend `.env.local`:

```env
NEXT_PUBLIC_VOICE_TTS_PROVIDER=indic-parler
```

Restart the existing AI bridge on port 8001, backend on port 4000, and frontend
on port 3000. No second bridge should be started. The first TTS call loads the
model and may take longer than later calls. The bridge reports whether the
isolated environment exists at `http://localhost:8001/tts/health`.

The TTS route uses the text and language already selected by the chatbot. Hindi
requests choose a consistent Hindi speaker and English requests choose the
recommended English voice. Speech recognition and chat/RAG remain unchanged.

## Runtime notes

- This is local inference, so there is no per-request TTS fee. Model download,
  disk use, electricity and hardware still have costs.
- The current `Ai/ml` environment reports CPU-only PyTorch. Indic Parler's
  0.9B-parameter checkpoint can run on CPU, but generation may be slow. CUDA is
  selected automatically when PyTorch detects a compatible NVIDIA GPU.
- The model requires accepting Hugging Face's gated access conditions. If model
  loading fails, the web voice controls continue with browser TTS and the Python
  bridge logs an actionable error.
- If the dedicated environment is missing, the chatbot falls back to browser
  speech and `/tts/health` reports `configured: false`.
- The project currently uses Piper's Pratham voice inside the separate local
  audio pipeline; the chatbot's unified voice controls previously used browser
  speech synthesis. Indic Parler is now integrated into those chatbot controls.
