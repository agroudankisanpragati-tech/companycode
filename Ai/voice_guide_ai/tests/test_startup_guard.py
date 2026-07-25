from pathlib import Path
import sys

_HERE = Path(__file__).resolve().parent.parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))

import api_bridge


def test_runtime_start_is_singleton(monkeypatch):
    start_calls = []

    class FakeRuntime:
        def __init__(self):
            self.started = False

        def start(self):
            start_calls.append("start")
            self.started = True

        def stop(self):
            self.started = False

        def get_status(self):
            return {"started": self.started}

    monkeypatch.setattr(api_bridge, "_runtime", None)
    monkeypatch.setattr(api_bridge, "RuntimeManager", FakeRuntime)

    api_bridge.ensure_runtime_started()
    api_bridge.ensure_runtime_started()

    assert start_calls.count("start") == 1
