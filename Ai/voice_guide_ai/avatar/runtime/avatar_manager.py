"""
Avatar Runtime — Avatar Manager.

High-level facade that coordinates all avatar sub-managers.
This is the primary interface for the rest of the Voice Guide AI
system to interact with the avatar.
"""

from __future__ import annotations

from typing import Any, Optional

from config.logger import get_logger
from avatar.runtime.avatar_loader import AvatarLoader, LoadResult
from avatar.runtime.avatar_state import AvatarState, AvatarStateMachine
from avatar.runtime.event_manager import AvatarEventType, EventManager, EventCallback
from avatar.runtime.expression_manager import ExpressionManager
from avatar.runtime.animation_manager import AnimationManager
from avatar.runtime.lip_sync_manager import LipSyncManager
from avatar.runtime.position_manager import PositionManager
from avatar.runtime.theme_manager import ThemeManager
from avatar.runtime.asset_manager import AssetManager

_log = get_logger("avatar.manager")


class AvatarManager:
    """
    Central coordinator for the Kisan Saathi avatar runtime.

    Responsibilities
    ----------------
    * Lazy-load all subsystems via AvatarLoader
    * Expose unified API: show, hide, speak, listen, think, animate
    * Coordinate expression + animation + lip sync together
    * Emit events through EventManager
    * Maintain avatar state via AvatarStateMachine
    * Never crash — always fall back to neutral
    """

    def __init__(self) -> None:
        self._loader  = AvatarLoader()
        self._sm      = AvatarStateMachine()
        self._events  = EventManager()
        self._visible = False

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def load(self) -> LoadResult:
        """Load all avatar subsystems. Safe to call multiple times."""
        result = self._loader.load()
        if result.success or result.avatar_id:
            self._sm.force(AvatarState.READY)
            self._events.emit_loaded(result.avatar_id)
        else:
            self._sm.force(AvatarState.ERROR)
            self._events.emit_error("Avatar load failed", str(result.errors))
        return result

    def show(self) -> None:
        """Make the avatar visible and transition to IDLE."""
        if not self._loader.is_loaded():
            self.load()
        self._visible = True
        self._sm.force(AvatarState.IDLE)
        self._set_expression("neutral")
        self._play_animation("idle")
        _log.info("Avatar shown.")

    def hide(self) -> None:
        """Hide the avatar."""
        self._visible = False
        self._sm.force(AvatarState.HIDDEN)
        self._events.emit_hidden()
        _log.info("Avatar hidden.")

    def reset(self) -> None:
        """Reset avatar to idle neutral state."""
        self._sm.reset()
        self._set_expression("neutral")
        self._play_animation("idle")
        _log.info("Avatar reset to idle.")

    # ── Behaviour triggers ────────────────────────────────────────────────────

    def speak(self) -> None:
        """Transition avatar to speaking state."""
        self._sm.force(AvatarState.SPEAKING)
        self._set_expression("speaking")
        self._play_animation("speaking")
        self._lip_sync.on_speaking_start()
        self._events.emit_lip_sync_started()
        _log.info("Avatar speaking.")

    def stop_speaking(self) -> None:
        """Stop speaking and return to idle."""
        self._lip_sync.on_speaking_stop()
        self._events.emit_lip_sync_finished()
        self._sm.force(AvatarState.IDLE)
        self._set_expression("neutral")
        self._play_animation("idle")
        _log.info("Avatar stopped speaking.")

    def listen(self) -> None:
        """Transition avatar to listening state."""
        self._sm.force(AvatarState.LISTENING)
        self._set_expression("listening")
        self._play_animation("listening")
        _log.info("Avatar listening.")

    def think(self) -> None:
        """Transition avatar to thinking state."""
        self._sm.force(AvatarState.THINKING)
        self._set_expression("thinking")
        self._play_animation("thinking")
        _log.info("Avatar thinking.")

    def greet(self, style: str = "namaste") -> None:
        """Play a greeting animation (namaste or wave)."""
        anim = style if style in ("namaste", "wave") else "namaste"
        self._sm.force(AvatarState.ANIMATING)
        self._set_expression("smile")
        self._play_animation(anim)
        _log.info("Avatar greeting: %s", anim)

    def celebrate(self) -> None:
        """Play success animation."""
        self._sm.force(AvatarState.ANIMATING)
        self._set_expression("happy")
        self._play_animation("success")
        self._events.emit_animation_started("success")
        _log.info("Avatar celebrating.")

    def warn(self) -> None:
        """Show warning expression and animation."""
        self._sm.force(AvatarState.ANIMATING)
        self._set_expression("warning")
        self._play_animation("warning")
        _log.info("Avatar warning.")

    def show_error(self) -> None:
        """Show error expression and animation."""
        self._sm.force(AvatarState.ERROR)
        self._set_expression("error")
        self._play_animation("error")
        self._events.emit_error("Avatar error state triggered.")
        _log.info("Avatar error.")

    def say_goodbye(self) -> None:
        """Play goodbye animation."""
        self._sm.force(AvatarState.ANIMATING)
        self._set_expression("goodbye")
        self._play_animation("goodbye")
        _log.info("Avatar goodbye.")

    def nod(self) -> None:
        """Head nod animation."""
        self._play_animation("head_nod")
        self._lip_sync.nod()

    def shake_head(self) -> None:
        """Head shake animation."""
        self._play_animation("head_shake")
        self._lip_sync.shake()

    def show_loading(self) -> None:
        """Show loading state."""
        self._sm.force(AvatarState.ANIMATING)
        self._set_expression("loading")
        self._play_animation("loading")

    # ── Expression / Animation direct control ─────────────────────────────────

    def set_expression(self, expression_id: str) -> bool:
        """Directly set an expression by ID."""
        prev = self._expressions.current
        result = self._set_expression(expression_id)
        if prev != self._expressions.current:
            self._events.emit_expression_changed(prev, self._expressions.current)
        return result

    def play_animation(self, animation_id: str) -> bool:
        """Directly play an animation by ID."""
        self._events.emit_animation_started(animation_id)
        result = self._play_animation(animation_id)
        return result

    # ── Theme / Position ──────────────────────────────────────────────────────

    def set_theme(self, theme_id: str) -> bool:
        """Apply a theme by ID."""
        prev = self._themes.current
        result = self._themes.set_theme(theme_id)
        if prev != self._themes.current:
            self._events.emit_theme_changed(prev, self._themes.current)
        return result

    def set_position(self, position_id: str, viewport: str = "desktop") -> dict[str, str]:
        """Set avatar position and return CSS property dict."""
        prev = self._positions.current
        self._positions.set_position(position_id)
        if prev != self._positions.current:
            self._events.emit_position_changed(prev, self._positions.current)
        return self._positions.resolve_css(viewport=viewport)

    # ── Lip sync ──────────────────────────────────────────────────────────────

    def apply_phoneme(self, phoneme: str) -> str:
        """Apply a phoneme for lip sync. Returns mouth shape ID."""
        return self._lip_sync.apply_phoneme(phoneme)

    def tick(self) -> None:
        """Advance animation frame and lip sync blink timer."""
        self._animations.tick()
        self._lip_sync.tick()

    # ── Event subscription ────────────────────────────────────────────────────

    def on_event(self, event_type: AvatarEventType, callback: EventCallback) -> None:
        self._events.subscribe(event_type, callback)

    def on_any_event(self, callback: EventCallback) -> None:
        self._events.subscribe_all(callback)

    # ── Status ────────────────────────────────────────────────────────────────

    def get_status(self) -> dict[str, Any]:
        return {
            "state":            self._sm.state.value,
            "visible":          self._visible,
            "expression":       self._expressions.current,
            "animation":        self._animations.current_animation_id,
            "theme":            self._themes.current,
            "position":         self._positions.current,
            "is_speaking":      self._lip_sync.is_speaking,
            "cache_stats":      self._assets.cache_stats(),
        }

    # ── Sub-manager accessors ─────────────────────────────────────────────────

    @property
    def _assets(self) -> AssetManager:
        return self._loader.asset_manager

    @property
    def _expressions(self) -> ExpressionManager:
        return self._loader.expression_manager

    @property
    def _animations(self) -> AnimationManager:
        return self._loader.animation_manager

    @property
    def _lip_sync(self) -> LipSyncManager:
        return self._loader.lip_sync_manager

    @property
    def _positions(self) -> PositionManager:
        return self._loader.position_manager

    @property
    def _themes(self) -> ThemeManager:
        return self._loader.theme_manager

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _set_expression(self, expression_id: str) -> bool:
        try:
            return self._expressions.set_expression(expression_id)
        except Exception as exc:
            _log.error("set_expression failed for '%s': %s", expression_id, exc)
            try:
                self._expressions.set_expression("neutral")
            except Exception:
                pass
            return False

    def _play_animation(self, animation_id: str) -> bool:
        try:
            return self._animations.play(animation_id)
        except Exception as exc:
            _log.error("play_animation failed for '%s': %s", animation_id, exc)
            try:
                self._animations.play("idle")
            except Exception:
                pass
            return False
