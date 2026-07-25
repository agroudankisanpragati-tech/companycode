"""
Avatar Runtime — Avatar Controller.

The single public entry point for the entire avatar system.
Wraps AvatarManager and maps dialogue engine events to avatar
behaviours. All methods are safe — never raise to callers.
"""

from __future__ import annotations

from typing import Any

from config.logger import get_logger
from avatar.runtime.avatar_manager import AvatarManager
from avatar.runtime.avatar_loader import LoadResult
from avatar.runtime.avatar_state import AvatarState
from avatar.runtime.event_manager import AvatarEventType, EventCallback

_log = get_logger("avatar.controller")


class AvatarController:
    """
    Top-level controller for Kisan Saathi avatar.

    Usage::

        controller = AvatarController()
        controller.initialise()
        controller.on_dialogue_play("home", "welcome")
        controller.on_speaking_start()
        controller.on_speaking_stop()
    """

    def __init__(self) -> None:
        self._manager = AvatarManager()
        self._initialised = False

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def initialise(self) -> LoadResult:
        """Initialise the avatar system. Safe to call multiple times."""
        if self._initialised:
            return self._manager.load()
        result = self._manager.load()
        self._initialised = True
        if result.success:
            _log.info("AvatarController initialised: %s", result.avatar_id)
        else:
            _log.warning("AvatarController initialised with errors: %s", result.errors)
        return result

    def show(self) -> None:
        """Show the avatar in idle state."""
        self._ensure_init()
        self._safe("show", self._manager.show)

    def hide(self) -> None:
        """Hide the avatar."""
        self._safe("hide", self._manager.hide)

    def reset(self) -> None:
        """Reset avatar to neutral idle."""
        self._safe("reset", self._manager.reset)

    # ── Dialogue engine integration ───────────────────────────────────────────

    def on_dialogue_play(self, page: str, dialogue_type: str) -> None:
        """Called when a dialogue begins playing."""
        self._ensure_init()
        _log.debug("Dialogue play: page=%s type=%s", page, dialogue_type)
        if dialogue_type in ("welcome", "success", "revisit"):
            self._safe("greet", self._manager.greet, "namaste")
        elif dialogue_type == "error":
            self._safe("show_error", self._manager.show_error)
        elif dialogue_type == "warning":
            self._safe("warn", self._manager.warn)
        elif dialogue_type in ("exit", "goodbye"):
            self._safe("say_goodbye", self._manager.say_goodbye)
        elif dialogue_type in ("processing", "thinking"):
            self._safe("think", self._manager.think)
        elif dialogue_type in ("loading", "offline"):
            self._safe("show_loading", self._manager.show_loading)
        else:
            self._safe("speak", self._manager.speak)

    def on_speaking_start(self) -> None:
        """Called when voice audio begins playing."""
        self._safe("speak", self._manager.speak)

    def on_speaking_stop(self) -> None:
        """Called when voice audio finishes."""
        self._safe("stop_speaking", self._manager.stop_speaking)

    def on_listening_start(self) -> None:
        """Called when STT begins listening."""
        self._safe("listen", self._manager.listen)

    def on_thinking_start(self) -> None:
        """Called when AI is processing."""
        self._safe("think", self._manager.think)

    def on_success(self) -> None:
        self._safe("celebrate", self._manager.celebrate)

    def on_error(self) -> None:
        self._safe("show_error", self._manager.show_error)

    def on_warning(self) -> None:
        self._safe("warn", self._manager.warn)

    def on_exit(self) -> None:
        self._safe("say_goodbye", self._manager.say_goodbye)

    # ── Direct controls ───────────────────────────────────────────────────────

    def set_expression(self, expression_id: str) -> bool:
        self._ensure_init()
        return self._manager.set_expression(expression_id)

    def play_animation(self, animation_id: str) -> bool:
        self._ensure_init()
        return self._manager.play_animation(animation_id)

    def set_theme(self, theme_id: str) -> bool:
        self._ensure_init()
        return self._manager.set_theme(theme_id)

    def set_position(self, position_id: str, viewport: str = "desktop") -> dict[str, str]:
        self._ensure_init()
        return self._manager.set_position(position_id, viewport)

    def apply_phoneme(self, phoneme: str) -> str:
        return self._manager.apply_phoneme(phoneme)

    def tick(self) -> None:
        """Advance animation frame and blink timer. Call on each render tick."""
        self._manager.tick()

    def nod(self) -> None:
        self._safe("nod", self._manager.nod)

    def shake_head(self) -> None:
        self._safe("shake_head", self._manager.shake_head)

    # ── Events ────────────────────────────────────────────────────────────────

    def on_event(self, event_type: AvatarEventType, callback: EventCallback) -> None:
        self._manager.on_event(event_type, callback)

    def on_any_event(self, callback: EventCallback) -> None:
        self._manager.on_any_event(callback)

    # ── Status ────────────────────────────────────────────────────────────────

    def get_status(self) -> dict[str, Any]:
        return self._manager.get_status()

    @property
    def state(self) -> AvatarState:
        return self._manager._sm.state

    @property
    def is_visible(self) -> bool:
        return self._manager._visible

    # ── Internal ──────────────────────────────────────────────────────────────

    def _ensure_init(self) -> None:
        if not self._initialised:
            self.initialise()

    def _safe(self, label: str, fn, *args, **kwargs) -> None:
        try:
            fn(*args, **kwargs)
        except Exception as exc:
            _log.error("AvatarController.%s failed: %s", label, exc)
            try:
                self._manager.reset()
            except Exception:
                pass
