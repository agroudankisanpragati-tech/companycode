# speech_to_text/tests/__init__.py
# Ensures the Ai/ root is on sys.path so all speech_to_text imports resolve
# correctly when pytest is invoked from any working directory.

from __future__ import annotations

import sys
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parent.parent.parent  # .../Ai/
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))
