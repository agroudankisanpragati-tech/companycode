"""
Voice Guide AI — Edge-TTS Generator.

Generates MP3 audio files from text using Microsoft Edge-TTS.

Features
--------
* Async generation via edge-tts library
* Voice config loaded from voices.json
* Per-language voice mapping with fallback
* Retry on transient network errors
* Cache-first: never regenerates existing valid files
* Checksum written alongside each MP3
* Thread-safe synchronous wrapper for use in batch workers
"""

from __future__ import annotations

import asyncio
import json
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from config.logger import get_logger
from voice.utils.audio_utils import AudioUtils
from voice.utils.audio_validator import AudioValidator
from voice.utils.checksum import ChecksumUtil
from voice.utils.file_utils import FileUtils
from voice.utils.filename_generator import FilenameGenerator

_log = get_logger("voice.generators.edge_tts")

_VOICES_CONFIG_NAME = "voices.json"
# RC-1 FIX: Synchronous retries inside generate() caused HTTP timeouts.
# generate() now makes exactly ONE attempt and returns immediately on failure.
# Retry logic lives in the background worker (VoiceEngine._generate_background)
# which runs after the HTTP response has already been sent.
_RETRY_ATTEMPTS = 1
_RETRY_DELAY_S  = 0.0


@dataclass
class GenerationResult:
    """Result of a single TTS generation attempt."""
    success:     bool
    language:    str
    module:      str
    dialogue_id: str
    path:        str = ""
    duration_s:  float = 0.0
    size_bytes:  int = 0
    checksum:    str = ""
    cached:      bool = False
    error:       Optional[str] = None
    attempts:    int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "success":     self.success,
            "language":    self.language,
            "module":      self.module,
            "dialogue_id": self.dialogue_id,
            "path":        self.path,
            "duration_s":  self.duration_s,
            "size_bytes":  self.size_bytes,
            "checksum":    self.checksum,
            "cached":      self.cached,
            "error":       self.error,
            "attempts":    self.attempts,
        }


class VoiceConfig:
    """Loads and provides voice configuration from voices.json."""

    def __init__(self, config_path: Path) -> None:
        self._data: dict[str, Any] = FileUtils.read_json(config_path, default={})
        self._voices: dict[str, Any] = self._data.get("voices", {})
        self._default_speed  = self._data.get("default_speed",  "+0%")
        self._default_pitch  = self._data.get("default_pitch",  "+0Hz")
        self._default_volume = self._data.get("default_volume", "+0%")

    def get_voice_id(self, language: str) -> str:
        """Return the Edge-TTS voice ID for *language*, with fallback chain."""
        cfg = self._voices.get(language)
        if cfg:
            return cfg.get("voice_id", "hi-IN-SwaraNeural")
        # Try family fallback: rj/marwari → hi
        family = language.split("/")[0]
        cfg = self._voices.get(family)
        if cfg:
            return cfg.get("voice_id", "hi-IN-SwaraNeural")
        return "hi-IN-SwaraNeural"

    def get_speed(self, language: str) -> str:
        cfg = self._voices.get(language, {})
        return cfg.get("speed", self._default_speed)

    def get_pitch(self, language: str) -> str:
        cfg = self._voices.get(language, {})
        return cfg.get("pitch", self._default_pitch)

    def get_volume(self, language: str) -> str:
        cfg = self._voices.get(language, {})
        return cfg.get("volume", self._default_volume)


class EdgeTTSGenerator:
    """
    Generates MP3 audio files using Microsoft Edge-TTS.

    Thread-safe.  Uses a per-instance asyncio event loop running in a
    dedicated thread so callers can use the synchronous ``generate()``
    method from any thread.
    """

    def __init__(
        self,
        base_dir: Path,
        configs_dir: Path,
    ) -> None:
        self._base_dir   = base_dir
        self._filename   = FilenameGenerator(base_dir)
        self._voice_cfg  = VoiceConfig(configs_dir / _VOICES_CONFIG_NAME)
        self._lock       = threading.Lock()
        self._loop       = asyncio.new_event_loop()
        self._loop_thread = threading.Thread(
            target=self._run_loop, daemon=True, name="edge-tts-loop"
        )
        self._loop_thread.start()

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    # ── Public API ────────────────────────────────────────────────────────────

    def generate(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        text: str,
        force: bool = False,
    ) -> GenerationResult:
        """
        Generate an MP3 for *text* in *language*.

        Parameters
        ----------
        language    : language code, e.g. "hi", "rj/marwari"
        module      : page/module name, e.g. "login"
        dialogue_id : dialogue identifier, e.g. "login_welcome_001"
        text        : text to synthesise
        force       : if True, regenerate even if cached file exists

        Returns
        -------
        GenerationResult
        """
        out_path = self._filename.audio_path(language, module, dialogue_id)

        # Cache hit — skip generation
        if not force and FileUtils.is_non_empty(out_path):
            validation = AudioValidator.validate(out_path)
            if validation.valid:
                _log.debug("Cache hit: %s", out_path.name)
                return GenerationResult(
                    success=True,
                    language=language,
                    module=module,
                    dialogue_id=dialogue_id,
                    path=str(out_path),
                    duration_s=AudioUtils.estimate_duration_seconds(out_path),
                    size_bytes=out_path.stat().st_size,
                    checksum=ChecksumUtil.compute_file(out_path) or "",
                    cached=True,
                )

        FileUtils.ensure_parent(out_path)
        voice_id = self._voice_cfg.get_voice_id(language)
        rate     = self._voice_cfg.get_speed(language)
        pitch    = self._voice_cfg.get_pitch(language)
        volume   = self._voice_cfg.get_volume(language)

        # RC-1 FIX: Single attempt only.  No blocking retries.
        try:
            future = asyncio.run_coroutine_threadsafe(
                self._synthesise(text, voice_id, rate, pitch, volume, out_path),
                self._loop,
            )
            future.result(timeout=60)

            validation = AudioValidator.validate(out_path)
            if not validation.valid:
                raise RuntimeError(f"Generated file invalid: {validation.error}")

            checksum = ChecksumUtil.compute_file(out_path) or ""
            duration = AudioUtils.estimate_duration_seconds(out_path)
            size     = out_path.stat().st_size

            _log.info(
                "Generated: %s/%s/%s (%.2fs, %d bytes)",
                language, module, dialogue_id, duration, size,
            )
            return GenerationResult(
                success=True,
                language=language,
                module=module,
                dialogue_id=dialogue_id,
                path=str(out_path),
                duration_s=duration,
                size_bytes=size,
                checksum=checksum,
                cached=False,
                attempts=1,
            )

        except Exception as exc:
            # Log once — no retry loop
            _log.warning(
                "Generation failed for %s/%s/%s: %s",
                language, module, dialogue_id, exc,
            )
            return GenerationResult(
                success=False,
                language=language,
                module=module,
                dialogue_id=dialogue_id,
                error=str(exc),
                attempts=1,
            )

    def is_cached(self, language: str, module: str, dialogue_id: str) -> bool:
        """Return True if a valid cached MP3 exists for this triple."""
        path = self._filename.audio_path(language, module, dialogue_id)
        return FileUtils.is_non_empty(path) and AudioValidator.validate(path).valid

    def shutdown(self) -> None:
        """Stop the internal event loop."""
        self._loop.call_soon_threadsafe(self._loop.stop)

    # ── Async synthesis ───────────────────────────────────────────────────────

    @staticmethod
    async def _synthesise(
        text: str,
        voice: str,
        rate: str,
        pitch: str,
        volume: str,
        out_path: Path,
    ) -> None:
        """
        Call edge-tts and write MP3 bytes to *out_path*.

        Raises RuntimeError if edge-tts is not installed.
        """
        try:
            import edge_tts  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError(
                "edge-tts is not installed. Run: pip install edge-tts"
            ) from exc

        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=rate,
            pitch=pitch,
            volume=volume,
        )
        await communicate.save(str(out_path))
