# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/context_resolver.py
# Purpose: Resolves follow-up and reference queries using session context.
#
# Handles references like:
#   "उसका इलाज"       → resolve to active_disease treatment
#   "दूसरी दवा"        → resolve to active_disease, ask for alternative
#   "और कोई उपाय"     → resolve to active_disease/crop
#   "ऑर्गेनिक तरीका"  → resolve to active_disease, organic treatment
#   "इलाज बताओ"       → resolve to active_disease from last YOLO result
#   "what is the cure" → resolve to active_disease
#
# Returns an enriched request dict with resolved crop/disease injected
# so the downstream KB handler can answer without asking again.
# =============================================================================

from __future__ import annotations

import re
from typing import Any, Optional

from knowledge_base.session_store import SessionStore, Slot, get_session_store


# ---------------------------------------------------------------------------
# REFERENCE PATTERNS
# ---------------------------------------------------------------------------

# Hindi/Hinglish follow-up patterns
_FOLLOWUP_HI = [
    r"उसका\s+इलाज",
    r"उसकी\s+दवा",
    r"उसका\s+उपचार",
    r"दूसरी\s+दवा",
    r"और\s+कोई\s+उपाय",
    r"ऑर्गेनिक\s+तरीका",
    r"जैविक\s+उपाय",
    r"रासायनिक\s+उपाय",
    r"इलाज\s+बताओ",
    r"उपचार\s+बताओ",
    r"दवाई\s+बताओ",
    r"क्या\s+करूं",
    r"अब\s+क्या",
    r"आगे\s+क्या",
    r"रोकथाम\s+कैसे",
    r"बचाव\s+कैसे",
]

# English / Hinglish (romanised Hindi) follow-up patterns
_FOLLOWUP_EN = [
    r"\bits\s+treatment\b",
    r"\btreat\s+it\b",
    r"\bcure\s+it\b",
    r"\bwhat\s+is\s+the\s+cure\b",
    r"\banother\s+medicine\b",
    r"\balternative\s+treatment\b",
    r"\borganic\s+method\b",
    r"\bchemical\s+treatment\b",
    r"\bwhat\s+to\s+do\b",
    r"\bnext\s+steps?\b",
    r"\bhow\s+to\s+prevent\b",
    r"\bprevention\b",
    r"\btreatment\b",
    r"\bcure\b",
    r"\bremedy\b",
    # Hinglish romanised
    r"\bilaj\b",
    r"\bilaj\s+batao\b",
    r"\bdawa\b",
    r"\bdawai\b",
    r"\bupchar\b",
    r"\bupay\b",
    r"\bkya\s+karu\b",
    r"\bkya\s+karen\b",
    r"\bkya\s+kare\b",
    r"\bab\s+kya\b",
    r"\bbachao\b",
    r"\bbachav\b",
    r"\broktham\b",
]

_COMPILED_HI = [re.compile(p) for p in _FOLLOWUP_HI]
_COMPILED_EN = [re.compile(p, re.IGNORECASE) for p in _FOLLOWUP_EN]

# Organic-specific patterns
_ORGANIC_HI = re.compile(r"ऑर्गेनिक|जैविक|प्राकृतिक")
_ORGANIC_EN = re.compile(r"\borganic\b|\bnatural\b|\bbio\b", re.IGNORECASE)

# Chemical-specific patterns
_CHEMICAL_HI = re.compile(r"रासायनिक|कीटनाशक|दवाई|स्प्रे")
_CHEMICAL_EN = re.compile(r"\bchemical\b|\bpesticide\b|\bspray\b|\bfungicide\b", re.IGNORECASE)


# ---------------------------------------------------------------------------
# CONTEXT RESOLVER
# ---------------------------------------------------------------------------

class ContextResolver:
    """
    Detects follow-up queries and enriches them with session context.

    Usage:
        resolver = get_context_resolver()
        enriched = resolver.resolve(request, session_id)
        # enriched["text"] now contains the resolved query
        # enriched["context_resolved"] = True if a reference was resolved
    """

    def __init__(self, store: Optional[SessionStore] = None) -> None:
        self._store = store or get_session_store()

    def resolve(
        self,
        request: dict[str, Any],
        session_id: str,
    ) -> dict[str, Any]:
        """
        Enriches a module request with session context.

        If the text is a follow-up reference, injects the active disease/crop
        into the text so the KB handler can answer directly.

        Args:
            request:    Module request dict (from DispatchRequest.to_module_request()).
            session_id: Session identifier.

        Returns:
            Enriched request dict. Always returns a dict — never raises.
        """
        # Always run follow-up detection even without session_id
        # (session_id only needed for disease/crop injection)

        text = str(request.get("text", "")).strip()
        lang = str(request.get("language", "latin"))

        is_followup, resolution_type = self._is_followup(text, lang)

        if not is_followup:
            if not session_id:
                return {**request, "context_resolved": False, "resolution_type": "",
                        "active_disease": "", "active_crop": "", "last_yolo": {},
                        "treatment_filter": ""}
            return self._inject_context(request, session_id, resolved=False, resolution_type="")

        # Resolve the reference — works even with empty session_id
        active_disease = self._store.get(session_id, Slot.ACTIVE_DISEASE) if session_id else ""
        active_crop    = self._store.get(session_id, Slot.ACTIVE_CROP)    if session_id else ""
        last_yolo      = self._store.get(session_id, Slot.LAST_YOLO_RESULT) if session_id else {}

        # Build enriched text
        enriched_text = text
        if active_disease:
            enriched_text = f"{active_disease} {text}"
        elif active_crop:
            enriched_text = f"{active_crop} {text}"
        elif last_yolo and last_yolo.get("class_name"):
            enriched_text = f"{last_yolo['class_name']} {text}"

        enriched = dict(request)
        enriched["text"]             = enriched_text
        enriched["original_text"]    = text
        enriched["context_resolved"] = True
        enriched["resolution_type"]  = resolution_type
        enriched["active_disease"]   = active_disease
        enriched["active_crop"]      = active_crop
        enriched["last_yolo"]        = last_yolo

        # Inject treatment type hint
        if resolution_type == "organic":
            enriched["treatment_filter"] = "organic"
        elif resolution_type == "chemical":
            enriched["treatment_filter"] = "chemical"
        else:
            enriched["treatment_filter"] = ""

        return enriched

    def _is_followup(self, text: str, lang: str) -> tuple[bool, str]:
        """Returns (is_followup, resolution_type)."""
        if not text:
            return False, ""

        # Check organic first (more specific)
        if _ORGANIC_HI.search(text) or _ORGANIC_EN.search(text):
            return True, "organic"

        if _CHEMICAL_HI.search(text) or _CHEMICAL_EN.search(text):
            return True, "chemical"

        # Hindi patterns
        for pattern in _COMPILED_HI:
            if pattern.search(text):
                return True, "treatment"

        # English patterns
        for pattern in _COMPILED_EN:
            if pattern.search(text):
                return True, "treatment"

        return False, ""

    def _inject_context(
        self,
        request: dict[str, Any],
        session_id: str,
        resolved: bool,
        resolution_type: str,
    ) -> dict[str, Any]:
        """Injects active context slots into the request without changing text."""
        enriched = dict(request)
        enriched["context_resolved"] = resolved
        enriched["resolution_type"]  = resolution_type
        enriched["active_disease"]   = self._store.get(session_id, Slot.ACTIVE_DISEASE)
        enriched["active_crop"]      = self._store.get(session_id, Slot.ACTIVE_CROP)
        enriched["last_yolo"]        = self._store.get(session_id, Slot.LAST_YOLO_RESULT)
        enriched["treatment_filter"] = ""
        return enriched

    def update_from_response(
        self,
        session_id: str,
        intent: str,
        module_id: str,
        response_data: Any,
        response_text: str,
        language: str,
    ) -> None:
        """
        Updates session context slots after a successful module response.
        Called by KB handlers after building their response.

        Args:
            session_id:    Session identifier.
            intent:        Resolved intent label.
            module_id:     Module that handled the request.
            response_data: Raw data returned by the module (list of docs or dict).
            response_text: The message string returned to the user.
            language:      Response language.
        """
        if not session_id:
            return

        slots: dict[str, Any] = {
            Slot.ACTIVE_INTENT: intent,
            Slot.ACTIVE_MODULE: module_id,
            Slot.LAST_RESPONSE: response_text[:500] if response_text else "",
            Slot.LANGUAGE:      language,
        }

        # Extract disease/crop from response data
        if isinstance(response_data, list) and response_data:
            doc = response_data[0]
            if isinstance(doc, dict):
                disease = doc.get("diseaseName") or doc.get("pestName") or ""
                crop    = doc.get("cropName") or ""
                if disease:
                    slots[Slot.ACTIVE_DISEASE] = disease
                if crop:
                    slots[Slot.ACTIVE_CROP] = crop
                slots[Slot.LAST_KB_DATA] = doc
        elif isinstance(response_data, dict):
            disease = response_data.get("diseaseName") or response_data.get("pestName") or ""
            crop    = response_data.get("cropName") or ""
            if disease:
                slots[Slot.ACTIVE_DISEASE] = disease
            if crop:
                slots[Slot.ACTIVE_CROP] = crop
            slots[Slot.LAST_KB_DATA] = response_data

        self._store.update(session_id, slots)


# ---------------------------------------------------------------------------
# SINGLETON
# ---------------------------------------------------------------------------

_resolver_instance: Optional[ContextResolver] = None
_resolver_lock = __import__("threading").Lock()


def get_context_resolver(force_rebuild: bool = False) -> ContextResolver:
    """Returns the singleton ContextResolver."""
    global _resolver_instance
    with _resolver_lock:
        if _resolver_instance is None or force_rebuild:
            _resolver_instance = ContextResolver()
    return _resolver_instance
