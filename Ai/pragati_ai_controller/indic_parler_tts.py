"""Lazy, local Indic Parler-TTS adapter used by the existing AI bridge.

The model is deliberately loaded only on the first TTS request. This keeps the
existing bridge usable when the optional package or gated model files are not
installed; callers can then fall back to browser speech synthesis.
"""

from __future__ import annotations

import base64
import io
import json
import os
import sys
import threading
from typing import Any

_MODEL_ID = os.getenv("INDIC_PARLER_MODEL", "ai4bharat/indic-parler-tts")
_MODEL: Any = None
_PROMPT_TOKENIZER: Any = None
_DESCRIPTION_TOKENIZER: Any = None
_TORCH: Any = None
_DEVICE = "cpu"
_LOAD_LOCK = threading.Lock()
_INFERENCE_LOCK = threading.Lock()

_LANGUAGES = {
    "as": ("Assamese", "Amit"),
    "bn": ("Bengali", "Arjun"),
    "brx": ("Bodo", "Bikram"),
    "doi": ("Dogri", "Karan"),
    "en": ("Indian English", "Mary"),
    "gu": ("Gujarati", "Neha"),
    "hi": ("Hindi", "Rohit"),
    "kn": ("Kannada", "Suresh"),
    "kok": ("Konkani", "Yash"),
    "mai": ("Maithili", "Aryan"),
    "ml": ("Malayalam", "Anjali"),
    "mni": ("Manipuri", "Laishram"),
    "mr": ("Marathi", "Sunita"),
    "ne": ("Nepali", "Amrita"),
    "or": ("Odia", "Manas"),
    "sa": ("Sanskrit", "Aryan"),
    "sat": ("Santali", "Sita"),
    "sd": ("Sindhi", "Rani"),
    "ta": ("Tamil", "Jaya"),
    "te": ("Telugu", "Prakash"),
    "ur": ("Urdu", "Karan"),
}


def _normalize_language(language: str, text: str) -> str:
    code = (language or "hi").lower().replace("_", "-").split("-")[0]
    if code in {"mwr", "mew", "raj", "marwari", "mewari"}:
        return "hi"
    if code in _LANGUAGES:
        return code
    if any("\u0900" <= char <= "\u097f" for char in text):
        return "hi"
    return "en"


def _load_model() -> tuple[Any, Any, Any, Any, str]:
    global _MODEL, _PROMPT_TOKENIZER, _DESCRIPTION_TOKENIZER, _TORCH, _DEVICE
    if _MODEL is not None:
        return _MODEL, _PROMPT_TOKENIZER, _DESCRIPTION_TOKENIZER, _TORCH, _DEVICE

    with _LOAD_LOCK:
        if _MODEL is not None:
            return _MODEL, _PROMPT_TOKENIZER, _DESCRIPTION_TOKENIZER, _TORCH, _DEVICE
        try:
            import torch
            import soundfile  # noqa: F401 - fail early with an actionable message
            from parler_tts import ParlerTTSForConditionalGeneration
            from transformers import AutoTokenizer
        except ImportError as exc:
            raise RuntimeError(
                "Indic Parler dependencies are missing from its isolated environment. "
                "Install Ai/requirements-indic-parler.txt in Ai/parler_tts_env."
            ) from exc

        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device.startswith("cuda") else torch.float32
        try:
            model = ParlerTTSForConditionalGeneration.from_pretrained(
                _MODEL_ID,
                torch_dtype=dtype,
            ).to(device)
            prompt_tokenizer = AutoTokenizer.from_pretrained(_MODEL_ID)
            description_tokenizer = AutoTokenizer.from_pretrained(
                model.config.text_encoder._name_or_path
            )
        except Exception as exc:
            raise RuntimeError(
                "Could not load Indic Parler-TTS. Accept the model access terms and run "
                "hf auth login from Ai/parler_tts_env, then retry."
            ) from exc

        _MODEL = model
        _PROMPT_TOKENIZER = prompt_tokenizer
        _DESCRIPTION_TOKENIZER = description_tokenizer
        _TORCH = torch
        _DEVICE = device
        return _MODEL, _PROMPT_TOKENIZER, _DESCRIPTION_TOKENIZER, _TORCH, _DEVICE


def get_tts_status() -> dict[str, Any]:
    """Return lightweight status; this function never loads model weights."""
    try:
        import importlib.util
        package_installed = all(
            importlib.util.find_spec(package) is not None
            for package in ("torch", "transformers", "parler_tts", "soundfile")
        )
    except (ImportError, ValueError):
        package_installed = False

    return {
        "provider": "indic-parler",
        "model": _MODEL_ID,
        "configured": package_installed,
        "loaded": _MODEL is not None,
        "device": _DEVICE if _MODEL is not None else None,
        "supportedLanguages": sorted(_LANGUAGES),
        "fallback": "browser-speech-synthesis",
    }


def _worker_main() -> None:
    """Read newline-delimited requests; keep the loaded model warm between turns."""
    for line in sys.stdin:
        try:
            request = json.loads(line)
            result = synthesize(str(request.get("text", "")), str(request.get("language", "hi")))
            response = {"audio_base64": result["audio_base64"], "language": result["language"]}
        except Exception as exc:
            response = {"error": str(exc)}
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def synthesize(text: str, language: str = "hi") -> dict[str, str]:
    """Generate a WAV response and return it base64 encoded for the Node API."""
    import soundfile as sf

    model, prompt_tokenizer, description_tokenizer, torch, device = _load_model()
    lang = _normalize_language(language, text)
    language_name, speaker = _LANGUAGES[lang]
    prompt = text.strip()
    description = (
        f"{speaker} speaks in {language_name} in a warm, natural, conversational voice. "
        "The delivery is clear, calm, moderately paced and expressive, with very clear audio "
        "and a close, clean recording."
    )

    description_inputs = description_tokenizer(description, return_tensors="pt").to(device)
    prompt_inputs = prompt_tokenizer(prompt, return_tensors="pt").to(device)
    # Limit tokens generated so audio is returned quickly even for longer replies.
    # 500 tokens ≈ 10-15 s of speech on the RTX 3050 — well within the frontend
    # 90-second timeout while still covering most farming question answers.
    # Increase this value (e.g. 800) only if you need longer spoken responses.
    max_tokens = int(os.getenv("INDIC_PARLER_MAX_TOKENS", "500"))
    try:
        with _INFERENCE_LOCK, torch.inference_mode():
            generated = model.generate(
                input_ids=description_inputs.input_ids,
                attention_mask=description_inputs.attention_mask,
                prompt_input_ids=prompt_inputs.input_ids,
                prompt_attention_mask=prompt_inputs.attention_mask,
                do_sample=True,
                max_new_tokens=max_tokens,
            )
        audio = generated.detach().cpu().numpy().squeeze()
        output = io.BytesIO()
        sf.write(output, audio, model.config.sampling_rate, format="WAV", subtype="PCM_16")
        return {
            "audio_base64": base64.b64encode(output.getvalue()).decode("ascii"),
            "language": lang,
        }
    except Exception:
        # Do not retain the model output or prompt in logs.
        raise


if __name__ == "__main__" and "--worker" in sys.argv:
    _worker_main()
