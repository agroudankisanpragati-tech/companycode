"""
Voice Guide AI — Audio Filename Generator.

Produces canonical, deterministic audio file paths from:
  language_code / module (page) / dialogue_id.mp3

Handles both flat languages (hi, en, gu …) and nested Rajasthani
dialects (rj/marwari, rj/bagri …).

Examples
--------
  hi  / login / login_welcome_001  →  voice/audio/hi/login/login_welcome_001.mp3
  rj/marwari / login / login_welcome_001
                                   →  voice/audio/rj/marwari/login/login_welcome_001.mp3
"""

from __future__ import annotations

from pathlib import Path

from config.logger import get_logger

_log = get_logger("voice.utils.filename_generator")

_AUDIO_ROOT = Path("voice") / "audio"


class FilenameGenerator:
    """Generates canonical audio file paths."""

    def __init__(self, base_dir: Path) -> None:
        """
        Parameters
        ----------
        base_dir : absolute path to the voice_guide_ai package root
        """
        self._base = base_dir

    # ── Public API ────────────────────────────────────────────────────────────

    def audio_path(
        self,
        language: str,
        module: str,
        dialogue_id: str,
    ) -> Path:
        """
        Return the absolute path for a generated MP3 file.

        Parameters
        ----------
        language    : language code, e.g. "hi", "rj/marwari"
        module      : page/module name, e.g. "login"
        dialogue_id : dialogue identifier, e.g. "login_welcome_001"
        """
        return self._base / _AUDIO_ROOT / language / module / f"{dialogue_id}.mp3"

    def audio_dir(self, language: str, module: str) -> Path:
        """Return the directory that holds MP3s for *language* / *module*."""
        return self._base / _AUDIO_ROOT / language / module

    def relative_path(
        self,
        language: str,
        module: str,
        dialogue_id: str,
    ) -> str:
        """Return the path relative to the voice_guide_ai root as a POSIX string."""
        return (
            _AUDIO_ROOT / language / module / f"{dialogue_id}.mp3"
        ).as_posix()

    def cache_key(self, language: str, module: str, dialogue_id: str) -> str:
        """Return a flat string cache key for the given triple."""
        return f"{language}/{module}/{dialogue_id}"

    @staticmethod
    def parse_language_path(language: str) -> tuple[str, str | None]:
        """
        Split a language code into (family, dialect).

        Examples
        --------
        "hi"          → ("hi", None)
        "rj/marwari"  → ("rj", "marwari")
        """
        parts = language.split("/", 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        return parts[0], None
