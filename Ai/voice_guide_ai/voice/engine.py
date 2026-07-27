"""
Voice Guide AI — Voice Engine.

Central facade that wires together:
  * EdgeTTSGenerator  (MP3 generation — always in background)
  * PlaybackController (audio + subtitle playback)
  * Cache validation
  * Metadata management

ROOT CAUSE FIX (RC-1):
  The original engine called generate_one() SYNCHRONOUSLY inside play().
  When edge-tts was unavailable or slow, the HTTP request blocked for the
  full retry duration (3 × 2 s = 6 s+), causing the 8 000 ms bridge timeout.

  New contract:
    * play() checks the cache first.
    * If the file exists → play immediately (< 1 ms).
    * If the file is missing → return False immediately, then fire a
      background thread to generate it.  The HTTP response is already
      gone before generation starts.
    * generate_one() is still available for explicit batch use.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Callable, Optional

from config.logger import get_logger
from voice.generators.batch_generator import BatchGenerator, BatchStats
from voice.generators.edge_tts import EdgeTTSGenerator, GenerationResult
from voice.players.audio_player import PlaybackEvent, PlaybackState
from voice.players.playback_controller import PlaybackController
from voice.players.subtitle_player import SubtitleFrame
from voice.utils.audio_validator import AudioValidator
from voice.utils.file_utils import FileUtils
from voice.utils.filename_generator import FilenameGenerator

_log = get_logger("voice.engine")

_CONFIGS_DIR   = Path("voice") / "configs"
_METADATA_DIR  = Path("voice") / "metadata"

# Maximum number of concurrent background generation threads.
_MAX_BG_WORKERS = 4
_bg_semaphore   = threading.Semaphore(_MAX_BG_WORKERS)


class VoiceEngine:
    """
    Central Voice Engine.

    Parameters
    ----------
    base_dir    : absolute path to voice_guide_ai/ package root.
                  Defaults to the parent of this file's directory.
    max_workers : parallel generation threads
    """

    def __init__(
        self,
        base_dir: Optional[Path] = None,
        max_workers: int = 4,
    ) -> None:
        self._base        = base_dir or Path(__file__).resolve().parent.parent
        self._max_workers = max_workers
        self._filename    = FilenameGenerator(self._base)
        self._controller  = PlaybackController(self._base)
        self._generator   = EdgeTTSGenerator(
            base_dir=self._base,
            configs_dir=self._base / _CONFIGS_DIR,
        )
        self._lock = threading.Lock()
        _log.info("VoiceEngine initialised | base=%s", self._base)

    # ── Generation ────────────────────────────────────────────────────────────

    def generate_all(
        self,
        languages: Optional[list[str]] = None,
        modules: Optional[list[str]] = None,
        force: bool = False,
    ) -> BatchStats:
        """
        Generate all missing MP3s from translations/.

        Parameters
        ----------
        languages : restrict to these language codes; None = all
        modules   : restrict to these module names; None = all
        force     : regenerate even if cached files exist
        """
        batch = BatchGenerator(
            base_dir=self._base,
            max_workers=self._max_workers,
            languages=languages,
            modules=modules,
            force=force,
        )
        return batch.run()

    def generate_one(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        text: str,
        force: bool = False,
    ) -> GenerationResult:
        """Generate a single MP3 file synchronously (for batch/admin use)."""
        return self._generator.generate(
            language=language,
            module=module,
            dialogue_id=dialogue_id,
            text=text,
            force=force,
        )

    def _generate_background(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        text: str,
    ) -> None:
        """
        Fire-and-forget background generation.

        Acquires a semaphore slot so we never flood the system with
        concurrent TTS requests.  Logs result but never raises.
        """
        def _worker() -> None:
            acquired = _bg_semaphore.acquire(blocking=False)
            if not acquired:
                _log.debug(
                    "Background generation skipped (semaphore full): %s/%s/%s",
                    language, module, dialogue_id,
                )
                return
            try:
                result = self._generator.generate(
                    language=language,
                    module=module,
                    dialogue_id=dialogue_id,
                    text=text,
                )
                if result.success:
                    _log.info(
                        "Background generation complete: %s/%s/%s",
                        language, module, dialogue_id,
                    )
                else:
                    _log.warning(
                        "Background generation failed: %s/%s/%s — %s",
                        language, module, dialogue_id, result.error,
                    )
            except Exception as exc:
                _log.warning(
                    "Background generation exception: %s/%s/%s — %s",
                    language, module, dialogue_id, exc,
                )
            finally:
                _bg_semaphore.release()

        t = threading.Thread(target=_worker, daemon=True, name=f"bg-tts-{dialogue_id}")
        t.start()

    def is_cached(self, language: str, module: str, dialogue_id: str) -> bool:
        """Return True if a valid cached MP3 exists."""
        path = self._filename.audio_path(language, module, dialogue_id)
        return FileUtils.is_non_empty(path) and AudioValidator.validate(path).valid

    # ── Playback ──────────────────────────────────────────────────────────────

    def play(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        text: Optional[str] = None,
        rtl: bool = False,
        duration_s: Optional[float] = None,
        auto_generate: bool = True,
    ) -> bool:
        """
        Play the MP3 for language/module/dialogue_id.

        RC-1 FIX: This method NEVER blocks on audio generation.

        Decision tree:
          1. File exists and is valid  → play immediately, return True.
          2. File missing, text given  → queue background generation,
                                         return False immediately.
          3. File missing, no text     → log warning, return False.

        The HTTP response is returned to the caller before any generation
        work begins.  When the file is eventually generated it will be
        available for the next play() call (cache hit).

        Parameters
        ----------
        language      : language code
        module        : page/module name
        dialogue_id   : dialogue identifier
        text          : subtitle text (also used for background generation)
        rtl           : right-to-left subtitle flag
        duration_s    : audio duration hint for subtitle timing
        auto_generate : queue background generation if file is missing
        """
        path = self._filename.audio_path(language, module, dialogue_id)

        if FileUtils.is_non_empty(path) and AudioValidator.validate(path).valid:
            # Cache hit — play immediately
            return self._controller.play(
                language=language,
                module=module,
                dialogue_id=dialogue_id,
                text=text,
                rtl=rtl,
                duration_s=duration_s,
            )

        # Cache miss
        if auto_generate and text:
            _log.info(
                "Audio not cached — queuing background generation: %s/%s/%s",
                language, module, dialogue_id,
            )
            self._generate_background(language, module, dialogue_id, text)
        else:
            _log.warning(
                "Audio not found and auto_generate=False (or no text): %s", path
            )

        # Return False immediately — do NOT block
        return False

    def pause(self) -> None:
        self._controller.pause()

    def resume(self) -> None:
        self._controller.resume()

    def stop(self) -> None:
        self._controller.stop()

    def replay(self) -> bool:
        return self._controller.replay()

    def seek(self, seconds: float) -> None:
        self._controller.seek(seconds)

    def seek_forward(self, step_s: float = 5.0) -> None:
        self._controller.seek_forward(step_s)

    def seek_backward(self, step_s: float = 5.0) -> None:
        self._controller.seek_backward(step_s)

    # ── Queue ─────────────────────────────────────────────────────────────────

    def enqueue(self, language: str, module: str, dialogue_id: str) -> None:
        self._controller.enqueue(language, module, dialogue_id)

    def clear_queue(self) -> None:
        self._controller.clear_queue()

    # ── Volume / Speed ────────────────────────────────────────────────────────

    def set_volume(self, volume: float) -> None:
        self._controller.set_volume(volume)

    def get_volume(self) -> float:
        return self._controller.get_volume()

    def mute(self) -> None:
        self._controller.mute()

    def unmute(self) -> None:
        self._controller.unmute()

    def toggle_mute(self) -> None:
        self._controller.toggle_mute()

    def set_speed(self, speed: float) -> None:
        self._controller.set_speed(speed)

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def on_playback_event(self, callback: Callable[[PlaybackEvent], None]) -> None:
        self._controller.on_playback_event(callback)

    def on_subtitle_update(self, callback: Callable[[SubtitleFrame], None]) -> None:
        self._controller.on_subtitle_update(callback)

    # ── State ─────────────────────────────────────────────────────────────────

    @property
    def state(self) -> PlaybackState:
        return self._controller.state

    @property
    def is_playing(self) -> bool:
        return self._controller.is_playing

    @property
    def position_s(self) -> float:
        return self._controller.position_s

    # ── Cache management ──────────────────────────────────────────────────────

    def validate_cache(self, language: Optional[str] = None) -> dict:
        """
        Scan audio directory and validate all cached MP3s.

        Returns a summary dict with valid/invalid counts.
        """
        audio_dir = self._base / "voice" / "audio"
        if language:
            audio_dir = audio_dir / language

        valid = invalid = 0
        invalid_files: list[str] = []

        for mp3 in FileUtils.scan_mp3_files(audio_dir):
            result = AudioValidator.validate(mp3)
            if result.valid:
                valid += 1
            else:
                invalid += 1
                invalid_files.append(str(mp3))
                _log.warning("Invalid cache file: %s — %s", mp3, result.error)

        summary = {
            "valid": valid,
            "invalid": invalid,
            "invalid_files": invalid_files,
            "total": valid + invalid,
        }
        _log.info("Cache validation: %d valid, %d invalid", valid, invalid)
        return summary

    def rebuild_audio_index(self) -> int:
        """
        Rebuild audio_index.json by scanning all existing MP3 files.

        Returns the number of indexed files.
        """
        from voice.utils.audio_utils import AudioUtils
        from voice.utils.checksum import ChecksumUtil

        audio_dir = self._base / "voice" / "audio"
        entries: dict = {}

        for mp3 in FileUtils.scan_mp3_files(audio_dir):
            try:
                rel = mp3.relative_to(audio_dir)
                parts = rel.parts
                if len(parts) < 3:
                    continue
                if len(parts) == 4:
                    language = f"{parts[0]}/{parts[1]}"
                    module = parts[2]
                    dialogue_id = parts[3].replace(".mp3", "")
                else:
                    language = parts[0]
                    module = parts[1]
                    dialogue_id = parts[2].replace(".mp3", "")

                entries[mp3.as_posix()] = {
                    "language":    language,
                    "module":      module,
                    "dialogue_id": dialogue_id,
                    "duration_s":  AudioUtils.estimate_duration_seconds(mp3),
                    "size_bytes":  mp3.stat().st_size,
                    "checksum":    ChecksumUtil.compute_file(mp3) or "",
                }
            except Exception as exc:
                _log.warning("Cannot index %s: %s", mp3, exc)

        import datetime
        index = {
            "version":      "1.0.0",
            "generated_at": datetime.datetime.now().isoformat(),
            "total_files":  len(entries),
            "entries":      entries,
        }
        FileUtils.write_json(self._base / _METADATA_DIR / "audio_index.json", index)
        _log.info("Audio index rebuilt: %d files", len(entries))
        return len(entries)

    def shutdown(self) -> None:
        self._controller.shutdown()
        self._generator.shutdown()
        _log.info("VoiceEngine shutdown complete")
