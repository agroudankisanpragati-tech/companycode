"""
Avatar Runtime — Animation Manager.

Loads animation configuration, manages the active animation,
controls frame sequencing, loop behaviour, and priority-based
interruption. Falls back to idle on any failure.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from config.logger import get_logger
from config.paths import PATHS
from avatar.runtime.asset_manager import AssetManager

_log = get_logger("avatar.animation_manager")

_FALLBACK_ANIMATION = "idle"

FrameCallback = Callable[[str, str, bytes | None], None]
# (animation_id, frame_filename, frame_bytes)


@dataclass
class AnimationConfig:
    """Runtime representation of a single animation."""

    id:               str
    label:            str
    asset_dir:        str
    frames:           list[str]
    frame_duration_ms: int
    total_duration_ms: int
    loop:             bool
    expression:       str
    priority:         int
    interruptible:    bool
    fallback:         Optional[str]
    tags:             list[str] = field(default_factory=list)


@dataclass
class PlaybackSession:
    """Tracks the state of the currently playing animation."""

    animation_id:  str
    config:        AnimationConfig
    frame_index:   int = 0
    loop_count:    int = 0
    started_at:    float = field(default_factory=time.monotonic)
    is_playing:    bool = True
    is_paused:     bool = False

    def advance(self) -> bool:
        """Advance to next frame. Returns True if animation is still running."""
        self.frame_index += 1
        if self.frame_index >= len(self.config.frames):
            if self.config.loop:
                self.frame_index = 0
                self.loop_count += 1
                return True
            self.is_playing = False
            return False
        return True

    @property
    def current_frame(self) -> str:
        if self.frame_index < len(self.config.frames):
            return self.config.frames[self.frame_index]
        return self.config.frames[0]


class AnimationManager:
    """
    Manages avatar animation playback.

    Responsibilities
    ----------------
    * Load animations.json config
    * Play / stop / interrupt animations
    * Advance frames on tick
    * Emit frame callbacks
    * Enforce priority-based interruption rules
    * Fall back to idle on any failure
    """

    def __init__(self, asset_manager: Optional[AssetManager] = None) -> None:
        self._asset_manager = asset_manager or AssetManager()
        self._animations: dict[str, AnimationConfig] = {}
        self._session: Optional[PlaybackSession] = None
        self._frame_callbacks: list[FrameCallback] = []
        self._loaded = False

    # ── Initialisation ────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load animations.json from avatar/config/."""
        config_path = PATHS.root / "avatar" / "config" / "animations.json"
        if not config_path.exists():
            _log.warning("animations.json not found — using empty config.")
            return

        try:
            with open(config_path, encoding="utf-8-sig") as fh:
                raw: dict[str, Any] = json.load(fh)

            for anim_id, data in raw.get("animations", {}).items():
                self._animations[anim_id] = AnimationConfig(
                    id=data["id"],
                    label=data.get("label", anim_id),
                    asset_dir=data.get("asset_dir", f"avatar/animations/{anim_id}"),
                    frames=data.get("frames", []),
                    frame_duration_ms=data.get("frame_duration_ms", 200),
                    total_duration_ms=data.get("total_duration_ms", 1000),
                    loop=data.get("loop", False),
                    expression=data.get("expression", "neutral"),
                    priority=data.get("priority", 1),
                    interruptible=data.get("interruptible", True),
                    fallback=data.get("fallback"),
                    tags=data.get("tags", []),
                )

            self._loaded = True
            _log.info("Loaded %d animations.", len(self._animations))

        except Exception as exc:
            _log.error("Failed to load animations.json: %s", exc)

    # ── Playback control ──────────────────────────────────────────────────────

    def play(self, animation_id: str) -> bool:
        """
        Start playing *animation_id*.

        Respects priority — a lower-priority animation cannot interrupt
        a non-interruptible higher-priority one.

        Returns True if playback started, False if blocked.
        """
        if not self._loaded:
            self.load()

        config = self._animations.get(animation_id)
        if config is None:
            _log.warning("Animation '%s' not found — falling back to idle.", animation_id)
            animation_id = _FALLBACK_ANIMATION
            config = self._animations.get(animation_id)
            if config is None:
                _log.error("Fallback animation 'idle' also missing.")
                return False

        # Priority check
        if self._session and self._session.is_playing:
            current_cfg = self._session.config
            if not current_cfg.interruptible and config.priority <= current_cfg.priority:
                _log.debug(
                    "Animation '%s' blocked by non-interruptible '%s'.",
                    animation_id, self._session.animation_id,
                )
                return False

        self._session = PlaybackSession(animation_id=animation_id, config=config)
        _log.info(
            "Animation started: %s (frames=%d loop=%s priority=%d)",
            animation_id, len(config.frames), config.loop, config.priority,
        )
        return True

    def stop(self) -> None:
        """Stop the current animation immediately."""
        if self._session:
            _log.info("Animation stopped: %s", self._session.animation_id)
            self._session.is_playing = False
            self._session = None

    def tick(self) -> Optional[str]:
        """
        Advance the animation by one frame.

        Returns the current frame filename, or None if no animation is active.
        Emits frame callbacks with the frame bytes.
        """
        if self._session is None or not self._session.is_playing:
            return None

        frame = self._session.current_frame
        anim_id = self._session.animation_id

        # Load frame bytes and emit
        frame_bytes = self._asset_manager.get_animation_frame_bytes(anim_id, frame)
        for cb in self._frame_callbacks:
            try:
                cb(anim_id, frame, frame_bytes)
            except Exception as exc:
                _log.warning("Frame callback error: %s", exc)

        still_running = self._session.advance()
        if not still_running:
            _log.info("Animation finished: %s", anim_id)
            self._session = None

        return frame

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def on_frame(self, callback: FrameCallback) -> None:
        """Register a callback invoked on every frame advance."""
        self._frame_callbacks.append(callback)

    # ── Queries ───────────────────────────────────────────────────────────────

    @property
    def is_playing(self) -> bool:
        return self._session is not None and self._session.is_playing

    @property
    def current_animation_id(self) -> Optional[str]:
        return self._session.animation_id if self._session else None

    def get_config(self, animation_id: str) -> Optional[AnimationConfig]:
        return self._animations.get(animation_id)

    def get_expression_for(self, animation_id: str) -> str:
        cfg = self._animations.get(animation_id)
        return cfg.expression if cfg else "neutral"

    def all_ids(self) -> list[str]:
        return list(self._animations.keys())

    def frame_duration_ms(self, animation_id: str) -> int:
        cfg = self._animations.get(animation_id)
        return cfg.frame_duration_ms if cfg else 200
