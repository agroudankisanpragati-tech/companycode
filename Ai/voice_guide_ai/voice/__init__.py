"""
Voice Guide AI — Voice Engine.

Public API
----------
from voice import VoiceEngine

engine = VoiceEngine()
engine.generate_all()
engine.play("hi", "login", "login_welcome_001", text="...")
engine.pause()
engine.resume()
engine.stop()
engine.replay()
"""

from voice.engine import VoiceEngine

__all__ = ["VoiceEngine"]
