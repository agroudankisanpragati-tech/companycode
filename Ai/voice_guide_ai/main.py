"""
Voice Guide AI — Entry Point.

Demonstrates the complete Voice Guide Runtime lifecycle via RuntimeManager.
"""

from __future__ import annotations

from bootstrap import install_voice_guide_imports
from config.logger import setup_logging
from config.settings import SETTINGS
from runtime.runtime_manager import RuntimeManager

install_voice_guide_imports()


def main() -> None:
    setup_logging(level=SETTINGS.log_level)

    runtime = RuntimeManager()
    runtime.start()

    # Register global event listener
    runtime.event_dispatcher.on_any(
        lambda e: print(f"[EVENT] {e['event_type']} | {e['payload']}")
    )

    # Set initial conditions
    runtime.update_conditions({
        "logged_in": False,
        "farmer_profile_complete": False,
        "location_available": False,
        "permission_granted": False,
    })

    # Simulate first visit to home page
    result = runtime.open_page("home", language="hi")
    print("[NAV]", result)

    # Simulate language change
    lang_result = runtime.set_language("en")
    print("[LANG]", lang_result)

    # Replay last dialogue
    replay_result = runtime.replay()
    print("[REPLAY]", replay_result)

    # Simulate going offline
    runtime.set_online(False)
    offline_result = runtime.play("weather", "welcome")
    print("[OFFLINE]", offline_result)

    # Restore online
    runtime.set_online(True)

    # Return visit to home
    return_result = runtime.open_page("home")
    print("[RETURN]", return_result)

    # Full status snapshot
    print("[STATUS]", runtime.get_status())

    runtime.stop()


if __name__ == "__main__":
    main()
