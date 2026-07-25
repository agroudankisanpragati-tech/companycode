"""
Voice Guide AI — Offline TTS Generator.

Generates MP3 audio using Piper TTS (local, no internet required).
Used as fallback when Edge-TTS is unavailable or network is offline.

Piper binary is expected at:
  AI/voice_models/piper/piper.exe  (Windows)
  AI/voice_models/piper/piper      (Linux/macOS)

Voice models are expected at:
  AI/voice_models/voices/{language}/*.onnx
"""

from __future__ import annotations

import platform
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from config.logger import get_logger
from voice.utils.audio_validator import AudioValidator
from voice.utils.checksum import ChecksumUtil
from voice.utils.file_utils import FileUtils
from voice.utils.filename_generator import FilenameGenerator

_log = get_logger("voice.generators.offline_generator")

_PIPER_SUBDIR = Path("voice_models") / "piper"
_VOICES_SUBDIR = Path("voice_models") / "voices"

# Piper voice model mapping: language code → model filename stem
_PIPER_VOICE_MAP: dict[str, str] = {
    "hi": "hi_IN-hindi-medium",
    "en": "en_IN-english-medium",
}


@dataclass
class OfflineGenerationResult:
    success: bool
    language: str
    module: str
    dialogue_id: str
    path: str = ""
    error: Optional[str] = None
    cached: bool = False


class OfflineGenerator:
    """
    Offline TTS generator using Piper.

    Falls back gracefully if Piper is not installed.
    """

    def __init__(self, base_dir: Path) -> None:
        self._base = base_dir
        self._filename = FilenameGenerator(base_dir)
        self._piper_exe = self._find_piper()

    # ── Public API ────────────────────────────────────────────────────────────

    def is_available(self) -> bool:
        return self._piper_exe is not None

    def generate(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        text: str,
        force: bool = False,
    ) -> OfflineGenerationResult:
        out_path = self._filename.audio_path(language, module, dialogue_id)

        if not force and FileUtils.is_non_empty(out_path):
            if AudioValidator.validate(out_path).valid:
                return OfflineGenerationResult(
                    success=True, language=language, module=module,
                    dialogue_id=dialogue_id, path=str(out_path), cached=True,
                )

        if not self._piper_exe:
            return OfflineGenerationResult(
                success=False, language=language, module=module,
                dialogue_id=dialogue_id,
                error="Piper TTS not available",
            )

        model_path = self._find_model(language)
        if not model_path:
            return OfflineGenerationResult(
                success=False, language=language, module=module,
                dialogue_id=dialogue_id,
                error=f"No Piper voice model for language: {language}",
            )

        FileUtils.ensure_parent(out_path)

        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                wav_path = Path(tmp.name)

            cmd = [
                str(self._piper_exe),
                "--model", str(model_path),
                "--output_file", str(wav_path),
            ]
            result = subprocess.run(
                cmd,
                input=text.encode("utf-8"),
                capture_output=True,
                timeout=60,
            )
            if result.returncode != 0:
                raise RuntimeError(result.stderr.decode(errors="replace")[:200])

            # Convert WAV → MP3 via ffmpeg if available
            if shutil.which("ffmpeg"):
                mp3_cmd = [
                    "ffmpeg", "-y", "-i", str(wav_path),
                    "-ar", "24000", "-ac", "1", "-b:a", "128k",
                    str(out_path),
                ]
                subprocess.run(mp3_cmd, capture_output=True, timeout=30, check=True)
                wav_path.unlink(missing_ok=True)
            else:
                # Rename WAV as MP3 (not ideal but functional)
                wav_path.replace(out_path)

            if not AudioValidator.validate(out_path).valid:
                raise RuntimeError("Generated file failed validation")

            _log.info("Offline generated: %s/%s/%s", language, module, dialogue_id)
            return OfflineGenerationResult(
                success=True, language=language, module=module,
                dialogue_id=dialogue_id, path=str(out_path),
            )

        except Exception as exc:
            _log.error("Offline generation failed for %s/%s/%s: %s",
                       language, module, dialogue_id, exc)
            return OfflineGenerationResult(
                success=False, language=language, module=module,
                dialogue_id=dialogue_id, error=str(exc),
            )

    # ── Internal ──────────────────────────────────────────────────────────────

    def _find_piper(self) -> Optional[Path]:
        piper_dir = self._base.parent / _PIPER_SUBDIR
        exe_name = "piper.exe" if platform.system() == "Windows" else "piper"
        candidate = piper_dir / exe_name
        if candidate.is_file():
            return candidate
        # Also check PATH
        found = shutil.which("piper")
        return Path(found) if found else None

    def _find_model(self, language: str) -> Optional[Path]:
        family = language.split("/")[0]
        stem = _PIPER_VOICE_MAP.get(language) or _PIPER_VOICE_MAP.get(family)
        if not stem:
            return None
        voices_dir = self._base.parent / _VOICES_SUBDIR / family
        if not voices_dir.is_dir():
            return None
        for ext in (".onnx",):
            candidate = voices_dir / f"{stem}{ext}"
            if candidate.is_file():
                return candidate
        # Fallback: any .onnx in the language dir
        models = list(voices_dir.glob("*.onnx"))
        return models[0] if models else None
