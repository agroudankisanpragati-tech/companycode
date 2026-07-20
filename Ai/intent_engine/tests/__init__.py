# intent_engine/tests/__init__.py
# sys.path bootstrap — adds Ai/ root so all intent_engine imports resolve.
import sys
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))
