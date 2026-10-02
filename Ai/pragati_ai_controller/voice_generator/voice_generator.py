"""
AKP — Agroudan Kisan Pragati
File: pragati_ai_controller/voice_generator/voice_generator.py

Purpose: Piper TTS engine wrapper.
  - Calls piper.exe CLI to synthesize WAV audio from text.
  - Resolves voice model (.onnx) by language code.
  - Thread-safe: multiple requests can synthesize concurrently (different output files).
  - Falls back gracefully when piper.exe or model is missing.

Layout expected (from startup_validator.py):
  Ai/
    voice_models/
      piper/
        piper.exe            ← the binary
      voices/
        hi/
          hi_IN-pratham-medium.onnx
          hi_IN-pratham-medium.onnx.json
        en/
          en_IN-lessac-medium.onnx
          en_IN-lessac-medium.onnx.json
        ... (bn, te, mr, ta, ...)

Usage:
    from pragati_ai_controller.voice_generator.voice_generator import PiperTTSEngine
    engine = PiperTTSEngine()
    success = engine.synthesize("नमस्ते किसान भाई!", output_path, lang="hi")
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

_log = logging.getLogger("akp.voice_generator")

# ---------------------------------------------------------------------------
# PATH RESOLUTION
# ---------------------------------------------------------------------------

# This file lives at: Ai/pragati_ai_controller/voice_generator/voice_generator.py
# AI_ROOT  = Ai/
_MODULE_DIR = Path(__file__).resolve().parent          # voice_generator/
_PAC_ROOT   = _MODULE_DIR.parent                       # pragati_ai_controller/
_AI_ROOT    = _PAC_ROOT.parent                         # Ai/

# Default paths (match startup_validator.py _check_voice_model)
_DEFAULT_PIPER_EXE    = _AI_ROOT / "voice_models" / "piper" / "piper.exe"
_DEFAULT_VOICES_DIR   = _AI_ROOT / "voice_models" / "voices"
_DEFAULT_OUTPUTS_DIR  = _PAC_ROOT / "outputs" / "audio"

# Language code → subdirectory name inside voices/
# Ordered from most specific to least (BCP-47 prefix then 2-letter code).
_LANG_DIR_MAP: dict[str, str] = {
    "hi": "hindi",       "hi-in": "hindi",
    "en": "english",     "en-in": "english",
    "bn": "bengali",     "bn-in": "bengali",
    "te": "telugu",      "te-in": "telugu",
    "mr": "marathi",     "mr-in": "marathi",
    "ta": "tamil",       "ta-in": "tamil",
    "gu": "gujarati",    "gu-in": "gujarati",
    "pa": "punjabi",     "pa-in": "punjabi",
    "kn": "kannada",     "kn-in": "kannada",
    "ml": "malayalam",   "ml-in": "malayalam",
    "or": "hindi",       # Odia — fallback to Hindi voice
    "as": "hindi",       # Assamese — fallback to Hindi voice
}


# ---------------------------------------------------------------------------
# PIPER TTS ENGINE
# ---------------------------------------------------------------------------

class PiperTTSEngine:
    """Thin wrapper around the piper.exe CLI for offline neural TTS."""

    def __init__(
        self,
        piper_exe:   Optional[Path] = None,
        voices_dir:  Optional[Path] = None,
        outputs_dir: Optional[Path] = None,
    ) -> None:
        self.piper_exe   = Path(piper_exe)   if piper_exe   else _DEFAULT_PIPER_EXE
        self.voices_dir  = Path(voices_dir)  if voices_dir  else _DEFAULT_VOICES_DIR
        self.outputs_dir = Path(outputs_dir) if outputs_dir else _DEFAULT_OUTPUTS_DIR

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def is_available(self) -> bool:
        """Return True when piper.exe exists and at least one .onnx is present."""
        return (
            self.piper_exe.is_file()
            and any(self.voices_dir.rglob("*.onnx"))
            if self.voices_dir.exists()
            else False
        )

    def find_model(self, lang: str) -> Optional[Path]:
        """Find the best .onnx model for the given language code.

        Search order:
        1. Exact match in voices/<lang>/ directory.
        2. Any .onnx inside that directory.
        3. Hindi fallback if no match at all.
        """
        key = lang.lower().replace("_", "-")
        lang_dir_name = _LANG_DIR_MAP.get(key) or _LANG_DIR_MAP.get(key.split("-")[0], "hi")
        lang_dir = self.voices_dir / lang_dir_name

        if lang_dir.exists():
            # Prefer *-medium.onnx; fall back to any .onnx
            medium = sorted(lang_dir.glob("*-medium.onnx"))
            if medium:
                return medium[0]
            any_model = sorted(lang_dir.glob("*.onnx"))
            if any_model:
                return any_model[0]

        # Last resort: any .onnx in any subdirectory
        all_models = list(self.voices_dir.rglob("*.onnx")) if self.voices_dir.exists() else []
        if all_models:
            _log.warning("No voice model for lang=%s — using fallback: %s", lang, all_models[0].name)
            return all_models[0]

        return None

    def synthesize(
        self,
        text: str,
        output_path: Path,
        lang: str = "hi",
        timeout_seconds: int = 60,
    ) -> bool:
        """Synthesize text to a WAV file using piper.exe.

        Args:
            text:            Input text to synthesize.
            output_path:     Destination .wav file path (will be created).
            lang:            Language code ('hi', 'en', 'mr', …).
            timeout_seconds: Kill piper.exe after this many seconds.

        Returns:
            True on success, False on any error.
        """
        if not self.piper_exe.is_file():
            _log.error("piper.exe not found at %s", self.piper_exe)
            return False

        model = self.find_model(lang)
        if model is None:
            _log.error("No voice model available for lang=%s in %s", lang, self.voices_dir)
            return False

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # piper reads text from stdin and writes WAV to stdout (or --output_file)
        cmd = [
            str(self.piper_exe),
            "--model", str(model),
            "--output_file", str(output_path),
        ]

        t0 = time.monotonic()
        try:
            result = subprocess.run(
                cmd,
                input=text,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=timeout_seconds,
            )
            elapsed = time.monotonic() - t0

            if result.returncode != 0:
                _log.error(
                    "piper.exe failed | returncode=%d | stderr=%s",
                    result.returncode,
                    result.stderr[:500],
                )
                return False

            if not output_path.exists() or output_path.stat().st_size == 0:
                _log.error("piper.exe produced no output at %s", output_path)
                return False

            _log.info(
                "Piper synthesis OK | lang=%s model=%s chars=%d size=%d bytes elapsed=%.2fs",
                lang, model.name, len(text), output_path.stat().st_size, elapsed,
            )
            return True

        except subprocess.TimeoutExpired:
            _log.error("piper.exe timed out after %ds for lang=%s", timeout_seconds, lang)
            return False
        except Exception as exc:
            _log.error("piper.exe error: %s", exc)
            return False

    def synthesize_to_bytes(
        self,
        text: str,
        lang: str = "hi",
        timeout_seconds: int = 60,
    ) -> Optional[bytes]:
        """Synthesize text and return WAV bytes directly.

        Uses a temporary file internally — no output path needed.
        Returns None on failure.
        """
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        try:
            ok = self.synthesize(text, tmp_path, lang=lang, timeout_seconds=timeout_seconds)
            if ok and tmp_path.exists():
                return tmp_path.read_bytes()
            return None
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass
