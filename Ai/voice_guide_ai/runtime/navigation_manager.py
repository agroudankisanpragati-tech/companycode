"""
Voice Guide AI — Navigation Manager.

RC-3 FIX: Navigation now atomically cancels previous dialogue.
  open_page() calls dialogue_runtime.play() which:
    1. Advances the session token (invalidates any in-flight play)
    2. Posts STOP to the serial worker queue
    3. Posts PLAY to the serial worker queue
  The worker executes STOP before PLAY — guaranteed by queue ordering.
  No explicit stop() call needed here; it would only add contention.

RC-5 FIX: voice_engine.stop() is called inside the worker's STOP handler
  before any new PLAY command executes, so old audio never overlaps new.

Preserved:
  * (page, lang) 500 ms debounce guard
  * All event dispatches (page_opened, page_closed)
  * First-visit / return-visit detection
  * Translation support
"""

from __future__ import annotations

import time
from typing import Any, Optional

from config.logger import get_logger
from runtime.condition_manager import ConditionManager
from runtime.event_dispatcher import EventDispatcher
from runtime.page_tracker import PageTracker
from runtime.session_manager import SessionManager
from runtime.visit_manager import VisitManager

_log = get_logger("runtime.navigation_manager")

_FIRST_VISIT_DIALOGUE  = "welcome"
_RETURN_VISIT_DIALOGUE = "revisit"
_RETURN_VISIT_FALLBACK = "help"

_NAV_DEBOUNCE_MS = 500


class NavigationManager:
    """
    Manages page navigation and auto-triggers appropriate dialogues.
    """

    def __init__(
        self,
        page_tracker: PageTracker,
        session_manager: SessionManager,
        visit_manager: VisitManager,
        event_dispatcher: EventDispatcher,
        dialogue_runtime: Any,
        condition_manager: ConditionManager,
    ) -> None:
        self._page_tracker     = page_tracker
        self._session          = session_manager
        self._visits           = visit_manager
        self._events           = event_dispatcher
        self._dialogue_runtime = dialogue_runtime
        self._conditions       = condition_manager

        # Single shared DialogueSelector — created once, reused forever.
        from core.dialogue_selector import DialogueSelector
        self._ds = DialogueSelector()

        # Debounce state
        self._last_nav_key:    tuple[str, str] = ("", "")
        self._last_nav_time:   float = 0.0
        self._last_nav_result: Optional[dict[str, Any]] = None

    # ── Public API ────────────────────────────────────────────────────────────

    def open_page(
        self,
        page: str,
        language: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Navigate to *page*.

        RC-3 FIX: No explicit stop() call.
        dialogue_runtime.play() advances the token and posts STOP + PLAY
        to the serial worker queue in that order.  The worker guarantees
        STOP executes before PLAY — old audio is always cancelled first.
        """
        lang = language or self._session.current_language

        # Debounce identical navigation calls
        nav_key = (page, lang or "")
        now = time.monotonic()
        if (
            nav_key == self._last_nav_key
            and (now - self._last_nav_time) * 1000 < _NAV_DEBOUNCE_MS
            and self._last_nav_result is not None
        ):
            _log.debug("Debounced duplicate navigation: page=%s lang=%s", page, lang)
            return self._last_nav_result

        if not self._page_tracker.is_supported_page(page):
            _log.warning("Unsupported page: '%s'. Navigation recorded anyway.", page)

        is_first     = self._visits.is_first_visit(page)
        visit_record = self._visits.record_visit(page)

        self._page_tracker.navigate_to(page)
        self._session.set_page(page)
        self._conditions.set_first_visit(is_first)
        self._conditions.set("current_page", page)

        # Dispatch page_opened exactly once per real navigation
        self._events.page_opened(page, lang, is_first)

        dialogue_type = _FIRST_VISIT_DIALOGUE if is_first else _RETURN_VISIT_DIALOGUE

        if not is_first and not self._ds.dialogue_exists(page, _RETURN_VISIT_DIALOGUE):
            dialogue_type = _RETURN_VISIT_FALLBACK

        cond_ctx = self._conditions.get_context()
        condition_ctx = {
            "first_visit":        is_first,
            "page":               page,
            "logged_in":          cond_ctx.get("logged_in", False),
            "internet_available": cond_ctx.get("internet_available", True),
        }

        # RC-3: play() advances token → posts STOP → posts PLAY (in order).
        # Worker executes STOP before PLAY — guaranteed FIFO.
        dialogue_result = self._dialogue_runtime.play(
            page=page,
            dialogue_type=dialogue_type,
            language=lang,
            context=condition_ctx,
        )

        _log.info(
            "Page opened: %s | first_visit=%s | lang=%s | dialogue=%s",
            page, is_first, lang, dialogue_type,
        )

        result = {
            "page":            page,
            "language":        lang,
            "is_first_visit":  is_first,
            "total_visits":    visit_record.total_visits,
            "dialogue_type":   dialogue_type,
            "dialogue_result": dialogue_result,
        }

        self._last_nav_key    = nav_key
        self._last_nav_time   = now
        self._last_nav_result = result

        return result

    def close_page(self, page: str) -> dict[str, Any]:
        entry         = self._page_tracker.close_current_page()
        time_spent_ms = entry.time_spent_ms if entry else 0.0
        self._events.page_closed(page, time_spent_ms)
        _log.info("Page closed: %s | time_spent_ms=%.1f", page, time_spent_ms)
        return {"page": page, "time_spent_ms": time_spent_ms}

    def set_next_page(self, page: str) -> None:
        self._page_tracker.set_next_page(page)

    def get_navigation_history(self) -> list[dict[str, Any]]:
        return self._page_tracker.navigation_history()

    @property
    def current_page(self) -> Optional[str]:
        return self._page_tracker.current_page

    @property
    def previous_page(self) -> Optional[str]:
        return self._page_tracker.previous_page
