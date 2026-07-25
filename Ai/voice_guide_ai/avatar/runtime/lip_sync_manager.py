"""
Avatar Runtime — Lip Sync Manager.

Manages mouth shape sequencing during speech, automatic blinking,
head movement, and provides the hook for future AI-driven lip sync.
"""

from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from config.logger import get_logger
from config.paths import PATHS

_log = get_logger("avatar.lip_sync_manager")

LipSyncCallback = Callable[[str, str], None]
# (event_type, value)  e.g. ("mouth_shape", "open"), ("blink", "start")


@dataclass
class LipSyncConfig:
    """Runtime lip sync configuration."""

    enabled:           bool = True
    mode:              str  = "basic"
    frame_rate:        int  = 24
    sync_tolerance_ms: int  = 50
    blink_enabled:     bool = True
    blink_interval_min_ms: int = 2000
    blink_interval_max_ms: int = 6000
    blink_duration_ms: int  = 160
    head_movement_enabled: bool = True
    phoneme_map:       dict[str, str] = field(default_factory=dict)
    mouth_shapes:      dict[str, Any] = field(default_factory=dict)
    speaking_events:   dict[str, Any] = field(default_factory=dict)


class LipSyncManager:
    """
    Controls lip sync, blinking, and head movement for the avatar.

    Responsibilities
    ----------------
    * Load lip_sync.json config
    * Map phonemes to mouth shapes
    * Schedule automatic blinks
    * Emit speaking start/stop events
    * Provide hook for future AI lip sync
    * Log all events
    """

    def __init__(self) -> None:
        self._config = LipSyncConfig()
        self._callbacks: list[LipSyncCallback] = []
        self._is_speaking = False
        self._next_blink_at: float = 0.0
        self._loaded = False

    # ── Initialisation ────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load lip_sync.json from avatar/config/."""
        config_path = PATHS.root / "avatar" / "config" / "lip_sync.json"
        if not config_path.exists():
            _log.warning("lip_sync.json not found — using defaults.")
            self._schedule_next_blink()
            return

        try:
            with open(config_path, encoding="utf-8-sig") as fh:
                raw: dict[str, Any] = json.load(fh)

            blink = raw.get("blink", {})
            head  = raw.get("head_movement", {})

            self._config = LipSyncConfig(
                enabled=raw.get("enabled", True),
                mode=raw.get("mode", "basic"),
                frame_rate=raw.get("frame_rate", 24),
                sync_tolerance_ms=raw.get("sync_tolerance_ms", 50),
                blink_enabled=blink.get("enabled", True),
                blink_interval_min_ms=blink.get("interval_min_ms", 2000),
                blink_interval_max_ms=blink.get("interval_max_ms", 6000),
                blink_duration_ms=blink.get("duration_ms", 160),
                head_movement_enabled=head.get("enabled", True),
                phoneme_map=raw.get("phoneme_map", {}),
                mouth_shapes=raw.get("mouth_shapes", {}),
                speaking_events=raw.get("speaking_events", {}),
            )

            self._loaded = True
            self._schedule_next_blink()
            _log.info("Lip sync config loaded (mode=%s).", self._config.mode)

        except Exception as exc:
            _log.error("Failed to load lip_sync.json: %s", exc)
            self._schedule_next_blink()

    # ── Speaking control ──────────────────────────────────────────────────────

    def on_speaking_start(self) -> None:
        """Call when the avatar begins speaking."""
        if not self._loaded:
            self.load()

        self._is_speaking = True
        events = self._config.speaking_events.get("on_start", {})
        mouth = events.get("mouth_shape", "slightly_open")
        self._emit("speaking_start", mouth)
        self._emit("mouth_shape", mouth)
        _log.info("Lip sync: speaking started.")

    def on_speaking_stop(self) -> None:
        """Call when the avatar stops speaking."""
        self._is_speaking = False
        events = self._config.speaking_events.get("on_stop", {})
        mouth = events.get("mouth_shape", "closed")
        self._emit("speaking_stop", mouth)
        self._emit("mouth_shape", "closed")
        _log.info("Lip sync: speaking stopped.")

    def on_speaking_pause(self) -> None:
        """Call when speech is paused."""
        self._emit("mouth_shape", "closed")
        _log.debug("Lip sync: speaking paused.")

    def phoneme_to_mouth_shape(self, phoneme: str) -> str:
        """Map a phoneme string to a mouth shape ID."""
        pmap = self._config.phoneme_map
        return pmap.get(phoneme, pmap.get("default", "slightly_open"))

    def apply_phoneme(self, phoneme: str) -> str:
        """Apply a phoneme — emits mouth_shape event and returns shape ID."""
        shape = self.phoneme_to_mouth_shape(phoneme)
        self._emit("mouth_shape", shape)
        return shape

    # ── Blink ─────────────────────────────────────────────────────────────────

    def tick(self) -> None:
        """
        Call on every render tick to trigger automatic blinks.

        Should be called at approximately the configured frame_rate.
        """
        if not self._config.blink_enabled:
            return

        now = time.monotonic()
        if now >= self._next_blink_at:
            self._emit("blink", "start")
            _log.debug("Blink triggered.")
            self._schedule_next_blink()

    def force_blink(self) -> None:
        """Trigger an immediate blink."""
        self._emit("blink", "start")
        self._schedule_next_blink()

    # ── Head movement ─────────────────────────────────────────────────────────

    def nod(self) -> None:
        """Trigger a head nod (agreement)."""
        if self._config.head_movement_enabled:
            self._emit("head_movement", "nod")
            _log.debug("Head nod triggered.")

    def shake(self) -> None:
        """Trigger a head shake (disagreement)."""
        if self._config.head_movement_enabled:
            self._emit("head_movement", "shake")
            _log.debug("Head shake triggered.")

    # ── Future AI sync hook ───────────────────────────────────────────────────

    def apply_ai_sync_frame(self, frame_data: dict[str, Any]) -> None:
        """
        Apply a single frame from an AI lip sync model.

        Expected frame_data keys: ``mouth_openness`` (0.0–1.0),
        ``phoneme`` (str), ``head_rotation`` (dict).

        This method is a no-op until future_ai_sync.enabled is True.
        """
        if not self._config.mode == "ai":
            return

        mouth_openness = frame_data.get("mouth_openness", 0.0)
        phoneme        = frame_data.get("phoneme", "silence")
        shape = self.phoneme_to_mouth_shape(phoneme)
        self._emit("mouth_shape", shape)
        self._emit("mouth_openness", str(mouth_openness))

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def on_event(self, callback: LipSyncCallback) -> None:
        """Register a callback for lip sync events."""
        self._callbacks.append(callback)

    # ── Queries ───────────────────────────────────────────────────────────────

    @property
    def is_speaking(self) -> bool:
        return self._is_speaking

    @property
    def config(self) -> LipSyncConfig:
        return self._config

    # ── Internal ──────────────────────────────────────────────────────────────

    def _emit(self, event_type: str, value: str) -> None:
        for cb in self._callbacks:
            try:
                cb(event_type, value)
            except Exception as exc:
                _log.warning("Lip sync callback error: %s", exc)

    def _schedule_next_blink(self) -> None:
        interval_ms = random.randint(
            self._config.blink_interval_min_ms,
            self._config.blink_interval_max_ms,
        )
        self._next_blink_at = time.monotonic() + interval_ms / 1000.0
