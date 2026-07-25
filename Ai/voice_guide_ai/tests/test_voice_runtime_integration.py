from __future__ import annotations

import sys
from pathlib import Path

import pytest

from core.dialogue_engine import DialogueEngine

_HERE = Path(__file__).resolve().parent.parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))


class FakeVoiceEngine:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def play(self, language: str, module: str, dialogue_id: str, text: str | None = None, rtl: bool = False, duration_s: float | None = None, auto_generate: bool = True) -> bool:
        self.calls.append({"language": language, "module": module, "dialogue_id": dialogue_id, "text": text, "rtl": rtl, "duration_s": duration_s})
        return True


class FakeAvatarController:
    def __init__(self) -> None:
        self.events: list[str] = []

    def initialise(self) -> None:
        self.events.append("init")

    def on_dialogue_play(self, page: str, dialogue_type: str) -> None:
        self.events.append(f"dialogue:{page}:{dialogue_type}")

    def on_speaking_start(self) -> None:
        self.events.append("speaking_start")

    def on_speaking_stop(self) -> None:
        self.events.append("speaking_stop")


class FakeDialogueEngine:
    def __init__(self) -> None:
        self._callbacks: list = []

    def set_language(self, language: str) -> dict:
        return {"success": True, "language": language}

    def play(self, page: str, dialogue_type: str = "welcome", context: dict | None = None) -> dict:
        return {"success": True, "dialogue_id": f"{page}_{dialogue_type}_001", "page": page, "language": context.get("language", "hi") if context else "hi"}

    def emit_avatar(self, event: dict) -> None:
        self._callbacks.append(("avatar", event))

    def emit_voice(self, event: dict) -> None:
        self._callbacks.append(("voice", event))

    def pause(self) -> dict:
        return {"success": True}

    def resume(self) -> dict:
        return {"success": True}

    def stop(self) -> dict:
        return {"success": True}

    def replay(self) -> dict:
        return {"success": True}

    def on_avatar_event(self, callback) -> None:
        self._callbacks.append(("avatar", callback))

    def on_voice_event(self, callback) -> None:
        self._callbacks.append(("voice", callback))

    def get_status(self) -> dict:
        return {"state": "ready"}


def test_runtime_routes_voice_and_avatar_events() -> None:
    from runtime.dialogue_runtime import DialogueRuntime

    fake_voice_engine = FakeVoiceEngine()
    fake_avatar_controller = FakeAvatarController()
    fake_dialogue_engine = FakeDialogueEngine()

    runtime = DialogueRuntime(
        event_dispatcher=None,
        session_manager=None,
        queue_manager=None,
        visit_manager=None,
        condition_manager=None,
        replay_manager=None,
        error_manager=None,
        offline_manager=None,
        engine=fake_dialogue_engine,
        voice_engine=fake_voice_engine,
        avatar_controller=fake_avatar_controller,
    )

    runtime.play("home", "welcome", language="hi")

    assert fake_voice_engine.calls, "voice engine was not invoked"
    assert fake_avatar_controller.events, "avatar controller was not invoked"
