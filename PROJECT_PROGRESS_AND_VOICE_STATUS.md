# Project Progress and Current Voice Status

Updated: 30 September 2026  
Workspace: `D:\companycode`

This file is a handoff record of the work discussed and performed in this conversation. It describes the local development setup and does not contain API keys, Hugging Face tokens, passwords, or other secret values.

## Project goals covered so far

The work has focused on improving the existing Agroudan Kisan Pragati website and chatbot in place, rather than restarting the application:

- Make the chatbot answer using agricultural and website-specific information from its knowledge bases and RAG retrieval.
- Keep website navigation actions working while also returning useful step-by-step explanations.
- Make the selected language consistent for typed questions, microphone input, text answers, and spoken answers.
- Enable browser microphone input and replace the chatbot's default browser-generated speech with a more natural multilingual voice where possible.
- Keep all work local unless the user explicitly authorizes GitHub changes. No commit or push was made by the assistant in this work.

## Work completed or already present in the project

### Website knowledge and chatbot

- Reviewed the website and the supplied context/proposal/reference material, including website screenshots and chatbot output screenshots.
- Prepared separate website-context and agriculture-context knowledge-base material so website instructions and agriculture guidance can be retrieved for their respective query types.
- Added/used chunking, embeddings, and a Chroma-based retrieval path for the RAG work. The intended flow is retrieval first, followed by the configured language model composing a clear response from the retrieved context.
- Connected the chatbot path to an LLM. Recent backend logs identify the model route as `openrouter/free`; availability and model selection can depend on the configured provider and its current service status.
- Expanded deterministic navigation intents for website destinations, including crop recommendation, disease detection, login, and dashboard-related flows.
- Improved the chatbot response path so it can both navigate and explain the destination or form steps. Recent logs show website RAG answers completing for general and crop questions.
- Worked on keeping responses in the user's selected language and formatting instructions as ordered points.

### Voice input and spoken responses

- The microphone input uses the browser Speech Recognition API through the frontend voice hook. A separate microphone bridge is not required for that browser microphone path.
- The chatbot's spoken-response path was integrated with AI4Bharat Indic Parler-TTS through the existing AI bridge, with browser speech synthesis intended as a fallback.
- The bridge remains the existing Pragati AI bridge on port `8001`; Parler is launched as a child worker from a separate Python environment. It is not a second HTTP bridge.
- The voice-related backend/frontend changes were intended to leave page appearance unchanged. No intentional visual redesign of crop recommendation or other pages was part of this voice work.

## Current local runtime layout

| Component | Port | Runtime / purpose |
| --- | ---: | --- |
| Frontend | 3000 | Website and chatbot UI; `NEXT_PUBLIC_VOICE_TTS_PROVIDER=indic-parler` enables the local Parler request path. |
| Node backend | 4000 | Authenticated chatbot and voice API; `VOICE_TTS_PROVIDER=local` and `LOCAL_TTS_ENDPOINT=http://localhost:8001/tts` route local TTS to the AI bridge. |
| Existing AI bridge | 8001 | FastAPI Pragati bridge, started from `Ai\ml`; exposes `/health` and `/tts/*`. |
| Parler worker | No HTTP port | Child Python process from `Ai\parler_tts_env`; performs Indic Parler inference. |

The bridge command used on Windows is:

```powershell
cd D:\companycode\Ai
.\ml\Scripts\python.exe -m pragati_ai_controller.fastapi_bridge
```

The two Python environments serve different purposes:

- `Ai\ml` runs the existing AI bridge and the broader AI pipeline.
- `Ai\parler_tts_env` contains Parler and its compatible dependencies, Hugging Face CLI login, and CUDA-enabled PyTorch. The worker starts its Python interpreter automatically; do not run the bridge from this environment.

The local Parler environment was created and Hugging Face login was completed by the user. Access to the gated AI4Bharat model requires accepting the model conditions while signed in. The HF token must remain private and should not be put into this project document or committed to source control.

## Dependency conflict and isolation

Installing Parler dependencies into the shared `Ai\ml` environment caused conflicting protobuf constraints: Google/OpenTelemetry packages require newer protobuf, while `descript-audiotools` requires protobuf below 5. The shared environment was restored to its previous package set and `pip check` reported no broken requirements at that time. Parler dependencies were separated into `Ai\parler_tts_env` to avoid repeating that conflict.

## GPU and Parler findings

The machine exposes an NVIDIA GeForce RTX 3050 with 6 GB of VRAM. Initially, the Parler environment had CPU-only PyTorch, which could not use the GPU. The user installed the CUDA build in the Parler environment.

Verified locally after that installation:

- PyTorch in `Ai\parler_tts_env`: `2.14.0+cu130`.
- `torch.version.cuda`: `13.0`.
- `torch.cuda.is_available()`: `True`.
- The CUDA device is detected as the RTX 3050.
- `indic_parler_tts.py` selects `cuda:0` when CUDA is available, and the live inference worker was visible in `nvidia-smi` using the GPU.
- The gated model's `model.safetensors` download completed in the Hugging Face cache. Its file size was about 3.75 GB; GPU use during the observed run rose to about 4.8 GB out of 6 GB.

These findings confirm that CUDA is available and the worker reached GPU inference. They do not confirm that a complete audio response returned to the browser.

## Current issue: chatbot has no audible reply

The latest issue reported is that the chatbot now produces no audible speech: neither an audible Parler response nor the expected browser speech fallback.

### Evidence checked

- `issues.txt` contains chatbot answers and repeated requests to `POST /api/voice-engine/synthesize`. Earlier entries recorded `The operation was aborted due to timeout` from the voice engine.
- The backend is configured for local TTS, and the frontend is configured to use Indic Parler.
- The AI bridge starts successfully on port `8001`; its log showed successful startup and intent/RAG requests.
- `GET http://127.0.0.1:8001/tts/health` returned `configured: true` and the Parler worker interpreter path. Its `loaded` field is not a reliable indicator that model weights finished loading: it currently means the child process is alive.
- A direct short Hindi synthesis request to `/tts/synthesize` did not return within the 300-second client timeout. After the client timed out, the worker continued using the RTX 3050; GPU utilization and memory use increased. Therefore the inference path is taking too long or remaining occupied, rather than failing because CUDA is unavailable.
- `Ai_logs.txt` ends before the most recent TTS attempt and does not show a synthesis completion or failure for that attempt. The worker currently discards its stderr, which hides potentially useful inference diagnostics.
- Multiple synthesis POSTs in the backend log suggest repeated requests may be queued while speech generation is slow. In the current frontend hook, TTS state stays `idle` while waiting for Parler, so the play control does not show that it is generating audio and repeated clicks can submit additional requests.

### Most likely current failure path

1. The user clicks a reply's voice control.
2. The frontend sends a local Parler synthesis request and waits for the entire audio response.
3. Speech generation is slow; meanwhile, the frontend still appears idle and can send duplicate requests.
4. The bridge's persistent worker serializes those requests. The browser fallback only runs after the local request fails or times out, so the user may hear nothing for a long period.

This is the strongest explanation supported by the available logs and live checks. A final successful synthesis-and-playback round trip has not yet been verified.

## Current solution status

The no-audio investigation found that frontend logs contain repeated synthesis requests, while the voice control remained idle during local generation. The Parler worker was using CUDA, but a short direct request had not returned within five minutes; the worker kept consuming GPU while the browser waited. The existing frontend only fell back to browser speech after the local request failed, so a slow request could leave the user without timely audio.

Implemented locally:

1. `useVoiceAI` now changes TTS state to `loading` before requesting speech. Local synthesis is limited to a 30-second wait; on timeout it falls back to the existing browser Speech Synthesis API. A user stop or a newer playback still cancels that playback instead of starting a stale fallback.
2. `VoicePlayer` shows a preparing indicator and a cancel control during generation. `VoiceButton` is disabled while synthesis is loading to prevent repeat clicks from queuing more requests.
3. The AI bridge now logs Parler synthesis start/completion time and exposes separate worker-running and model-loaded status. Parler worker stderr is passed through to the bridge terminal for diagnostics.
4. The backend's local TTS timeout remains configurable and defaults to 300 seconds. The frontend's 30-second fallback is intentionally shorter so users can hear browser speech while slow local generation finishes.

Still required before calling the voice fix fully verified:

- Restart the existing bridge, backend, and frontend so they load the edited code. Stop the currently running bridge with `Ctrl+C` first; this also clears the long-running inference worker and releases its GPU memory. Start exactly one bridge using the command below, then restart the backend and frontend in their normal terminals.
- Test one short English and one short Hindi spoken reply. Confirm audio starts within about 30 seconds (Parler if it returns promptly, otherwise browser speech), and inspect bridge logs for synthesis duration or an error.

The implementation does not yet cap Parler's generated token count or stream its audio. If Parler keeps taking more than 30 seconds after model warm-up, users will hear browser speech for that request; separate performance work will be needed to make Parler itself return promptly.

## Restart and verification checklist for the next session

After pulling the latest local edits into the running processes:

1. Stop the existing app processes cleanly, then start one bridge only with the command above.
2. Restart the backend on port `4000` and the frontend on port `3000` so they load the current code and environment settings.
3. Check bridge health at `http://localhost:8001/health` and Parler status at `http://localhost:8001/tts/health`.
4. Test a short typed question and a short Hindi question; click the spoken-response control once and confirm either Parler audio or prompt browser fallback.
5. Watch the bridge terminal, `Ai_logs.txt`, and `issues.txt` for one request start and its completion/error. Check `nvidia-smi` during Parler inference.
6. Keep any Hugging Face token, API key, OTP, and other secret values redacted from logs or screenshots before sharing them.

## Files relevant to the current voice issue

- `Ai/pragati_ai_controller/indic_parler_tts.py` — Parler model loading, language/speaker selection, and audio generation.
- `Ai/pragati_ai_controller/indic_parler_worker.py` — persistent child-worker lifecycle and request serialization.
- `Ai/pragati_ai_controller/fastapi_bridge.py` — bridge `/tts/health` and `/tts/synthesize` endpoints.
- `backend/src/services/voiceProviderAdapter.ts` — Node backend proxy request and timeout.
- `backend/src/routes/voiceEngine.ts` — authenticated `/api/voice-engine/synthesize` route.
- `frontend/src/hooks/useVoiceAI.ts` — local TTS request, browser fallback, and playback state.
- `frontend/src/hooks/useVoiceEngine.ts` and `frontend/src/components/VoicePlayer.tsx` — shared voice actions and chatbot playback controls.
- `issues.txt` — backend/frontend local development log provided for diagnosis.
- `Ai_logs.txt` — AI bridge startup and request log provided for diagnosis.

## GitHub / project-change status

The user previously instructed that changes must not be added to GitHub without permission. No commit or push was made by the assistant. The workspace contains local modifications from the ongoing work; this progress record does not stage, commit, or publish them.
