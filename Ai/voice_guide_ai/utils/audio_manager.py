"""
Voice Guide AI — Audio Manager (utils layer).

Resolves audio file paths for dialogue playback, checks availability,
and provides a clean interface between the runtime and the voice layer.

Responsibilities
----------------
* Build canonical audio file paths from (language, page, dialogue_id)
* Check whether an audio file exists and is valid
* Return fallback language audio when primary is missing
* Provide audio metadata (duration, size, checksum) from the index
* Never raise — always return safe results
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from config.logger import get_logger
from config.paths import PATHS

_log = get_logger("utils.audio_manager")

_AUDIO_INDEX_PATH = Path("voice") / "metadata" / "audio_index.json"
_AUDIO_ROOT = Path("voice") / "audio"

# Fallback chain for audio: dialect → parent → hi → en
_AUDIO_FALLBACK: dict[str, str] = {
    "rj/bagri":     "hi",
    "rj/marwari":   "hi",
    "rj/mewari":    "hi",
    "rj/dhundhari": "hi",
    "rj/hadoti":    "hi",
    "rj/shekhawati":"hi",
    "rj/mewati":    "hi",
    "rj/wagdi":     "hi",
    "od":           "hi",
    "as":           "hi",
}


class AudioFileInfo:
    """Metadata for a resolved audio file."""

    def __init__(
        self,
        path: Path,
        language: str,
        module: str,
        dialogue_id: str,
        resolved_language: str,
        exists: bool,
        duration_s: float = 0.0,
        size_bytes: int = 0,
        checksum: str = "",
    ) -> None:
        self.path = path
        self.language = language
        self.module = module
        self.dialogue_id = dialogue_id
        self.resolved_language = resolved_language
        self.exists = exists
        self.duration_s = duration_s
        self.size_bytes = size_bytes
        self.checksum = checksum
        self.is_fallback = language != resolved_language

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": str(self.path),
            "language": self.language,
            "module": self.module,
            "dialogue_id": self.dialogue_id,
            "resolved_language": self.resolved_language,
            "exists": self.exists,
            "is_fallback": self.is_fallback,
            "duration_s": self.duration_s,
            "size_bytes": self.size_bytes,
            "checksum": self.checksum,
        }


class AudioManager:
    """
    Resolves and validates audio file paths for dialogue playback.

    Thread-safe (read-only after init).
    """

    def __init__(self, base_dir: Optional[Path] = None) -> None:
        self._base = base_dir or PATHS.root
        self._index: dict[str, Any] = self._load_index()

    # ── Public API ────────────────────────────────────────────────────────────

    def resolve(
        self,
        language: str,
        module: str,
        dialogue_id: str,
    ) -> AudioFileInfo:
        """
        Resolve the audio file path for the given triple.

        Tries the requested language first, then falls back through
        the fallback chain until a valid file is found.

        Parameters
        ----------
        language    : language code, e.g. "hi", "rj/marwari"
        module      : page/module name, e.g. "login"
        dialogue_id : dialogue identifier, e.g. "login_welcome_001"

        Returns
        -------
        AudioFileInfo — always returns, never raises
        """
        for lang in self._fallback_chain(language):
            path = self._build_path(lang, module, dialogue_id)
            if path.is_file() and path.stat().st_size > 0:
                meta = self._get_index_meta(str(path))
                return AudioFileInfo(
                    path=path,
                    language=language,
                    module=module,
                    dialogue_id=dialogue_id,
                    resolved_language=lang,
                    exists=True,
                    duration_s=meta.get("duration_s", 0.0),
                    size_bytes=meta.get("size_bytes", path.stat().st_size),
                    checksum=meta.get("checksum", ""),
                )

        # No file found in any fallback
        primary_path = self._build_path(language, module, dialogue_id)
        _log.warning(
            "Audio not found: lang=%s module=%s id=%s",
            language, module, dialogue_id,
        )
        return AudioFileInfo(
            path=primary_path,
            language=language,
            module=module,
            dialogue_id=dialogue_id,
            resolved_language=language,
            exists=False,
        )

    def exists(self, language: str, module: str, dialogue_id: str) -> bool:
        """Return True if a valid audio file exists for the given triple."""
        return self.resolve(language, module, dialogue_id).exists

    def get_path(self, language: str, module: str, dialogue_id: str) -> Optional[Path]:
        """Return the resolved Path or None if no audio file exists."""
        info = self.resolve(language, module, dialogue_id)
        return info.path if info.exists else None

    def list_available(self, language: str, module: str) -> list[str]:
        """
        Return all dialogue IDs that have audio files for language/module.
        """
        audio_dir = self._base / _AUDIO_ROOT / language / module
        if not audio_dir.is_dir():
            return []
        return sorted(f.stem for f in audio_dir.glob("*.mp3") if f.is_file())

    def get_metadata(
        self, language: str, module: str, dialogue_id: str
    ) -> dict[str, Any]:
        """Return audio metadata from the index, or empty dict if not found."""
        path = self._build_path(language, module, dialogue_id)
        return self._get_index_meta(str(path))

    def reload_index(self) -> None:
        """Reload the audio index from disk."""
        self._index = self._load_index()
        _log.debug("Audio index reloaded.")

    # ── Internal ──────────────────────────────────────────────────────────────

    def _build_path(self, language: str, module: str, dialogue_id: str) -> Path:
        return self._base / _AUDIO_ROOT / language / module / f"{dialogue_id}.mp3"

    def _fallback_chain(self, language: str) -> list[str]:
        chain = [language]
        fallback = _AUDIO_FALLBACK.get(language)
        if fallback and fallback not in chain:
            chain.append(fallback)
        if "hi" not in chain:
            chain.append("hi")
        if "en" not in chain:
            chain.append("en")
        return chain

    def _load_index(self) -> dict[str, Any]:
        index_path = self._base / _AUDIO_INDEX_PATH
        if not index_path.is_file():
            return {}
        try:
            with open(index_path, encoding="utf-8") as fh:
                data = json.load(fh)
            return data.get("entries", {})
        except Exception as exc:
            _log.warning("Cannot load audio index: %s", exc)
            return {}

    def _get_index_meta(self, path_str: str) -> dict[str, Any]:
        # Normalise path separators for index lookup
        normalised = path_str.replace("\\", "/")
        return self._index.get(normalised, self._index.get(path_str, {}))
