"""
Voice Guide AI — Navigation Manager.

Handles all page navigation events:
  * open_page  — navigate to a page, record visit, trigger welcome/greeting
  * close_page — record exit time, dispatch page_closed event
  * First-visit detection → full welcome dialogue
  * Return-visit detection → short greeting dialogue
  * Dispatches page_opened / page_closed runtime events
"""

from __future__ import annotations

from typing import Any, Optional

from config.logger import get_logger
from runtime.condition_manager import ConditionManager
from runtime.event_dispatcher import EventDispatcher
from runtime.page_tracker import PageTracker, SUPPORTED_PAGES
from runtime.session_manager import SessionManager
from runtime.visit_manager import VisitManager

_log = get_logger("runtime.navigation_manager")

# Dialogue type played on first visit vs return visit
_FIRST_VISIT_DIALOGUE  = "welcome"
_RETURN_VISIT_DIALOGUE = "revisit"
_RETURN_VISIT_FALLBACK = "help"


class NavigationManager:
    """
    Manages page navigation and auto-triggers appropriate dialogues.

    Depends on:
      * PageTracker       — navigation history and timing
      * SessionManager    — live session state
      * VisitManager      — first/return visit detection
      * EventDispatcher   — runtime event bus
      * DialogueRuntime   — dialogue playback (injected to avoid circular import)
      * ConditionManager  — condition context updates
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
        self._page_tracker = page_tracker
        self._session = session_manager
        self._visits = visit_manager
        self._events = event_dispatcher
        self._dialogue_runtime = dialogue_runtime
        self._conditions = condition_manager

    # ── Public API ────────────────────────────────────────────────────────────

    def open_page(
        self,
        page: str,
        language: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Navigate to *page*.

        Steps
        -----
        1. Validate page name.
        2. Record navigation in PageTracker.
        3. Update SessionManager.
        4. Record visit in VisitManager.
        5. Update condition context (first_visit flag).
        6. Dispatch page_opened event.
        7. Enqueue welcome (first visit) or help (return visit) dialogue.

        Returns
        -------
        dict with navigation metadata and dialogue result
        """
        if not self._page_tracker.is_supported_page(page):
            _log.warning("Unsupported page: '%s'. Navigation recorded anyway.", page)

        lang = language or self._session.current_language

        is_first = self._visits.is_first_visit(page)
        visit_record = self._visits.record_visit(page)

        self._page_tracker.navigate_to(page)
        self._session.set_page(page)
        self._conditions.set_first_visit(is_first)
        self._conditions.set("current_page", page)

        self._events.page_opened(page, lang, is_first)

        dialogue_type = _FIRST_VISIT_DIALOGUE if is_first else _RETURN_VISIT_DIALOGUE

        # Fall back to "help" if the page has no revisit dialogue file.
        if not is_first:
            from core.dialogue_selector import DialogueSelector as _DS
            if not _DS().dialogue_exists(page, _RETURN_VISIT_DIALOGUE):
                dialogue_type = _RETURN_VISIT_FALLBACK

        # Build full condition context so DialogueCondition can evaluate
        # firstVisit / loggedIn / internetRequired from the dialogue JSON.
        cond_ctx = self._conditions.get_context()
        condition_ctx = {
            "first_visit":        is_first,
            "page":               page,
            "logged_in":          cond_ctx.get("logged_in", False),
            "internet_available": cond_ctx.get("internet_available", True),
        }

        dialogue_result = self._dialogue_runtime.play(
            page=page,
            dialogue_type=dialogue_type,
            language=lang,
            context=condition_ctx,
        )

        _log.info(
            "Page opened: %s | first_visit=%s | lang=%s",
            page, is_first, lang,
        )

        return {
            "page": page,
            "language": lang,
            "is_first_visit": is_first,
            "total_visits": visit_record.total_visits,
            "dialogue_type": dialogue_type,
            "dialogue_result": dialogue_result,
        }

    def close_page(self, page: str) -> dict[str, Any]:
        """
        Record page exit and dispatch page_closed event.

        Returns
        -------
        dict with page and time_spent_ms
        """
        entry = self._page_tracker.close_current_page()
        time_spent_ms = entry.time_spent_ms if entry else 0.0

        self._events.page_closed(page, time_spent_ms)
        _log.info("Page closed: %s | time_spent_ms=%.1f", page, time_spent_ms)

        return {
            "page": page,
            "time_spent_ms": time_spent_ms,
        }

    def set_next_page(self, page: str) -> None:
        """Declare the intended next page for pre-loading."""
        self._page_tracker.set_next_page(page)

    def get_navigation_history(self) -> list[dict[str, Any]]:
        """Return full navigation history."""
        return self._page_tracker.navigation_history()

    @property
    def current_page(self) -> Optional[str]:
        return self._page_tracker.current_page

    @property
    def previous_page(self) -> Optional[str]:
        return self._page_tracker.previous_page
