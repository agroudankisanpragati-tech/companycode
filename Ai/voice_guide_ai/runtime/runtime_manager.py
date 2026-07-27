"""
Voice Guide AI — Runtime Manager.

Central controller that owns and coordinates every runtime subsystem:
  * DialogueRuntime   — dialogue lifecycle
  * NavigationManager — page navigation
  * PageTracker       — navigation history and timing
  * EventDispatcher   — runtime event bus
  * ReplayManager     — replay logic
  * VisitManager      — visit history
  * ConditionManager  — runtime condition evaluation
  * QueueManager      — priority dialogue queue
  * SessionManager    — live session state
  * OfflineManager    — offline mode switching
  * ErrorManager      — error recovery
  * Scheduler         — cooldown / 24-hour rules / background tasks
  * DialogueLoader    — cached dialogue loading
  * CacheManager      — shared in-memory cache

Thread-safe.  One instance per application session.
"""

from __future__ import annotations

import threading
from typing import Any, Optional

from avatar.runtime.avatar_controller import AvatarController
from config.logger import get_logger
from runtime.condition_manager import ConditionManager
from runtime.dialogue_runtime import DialogueRuntime
from runtime.error_manager import ErrorManager
from runtime.event_dispatcher import EventDispatcher
from runtime.navigation_manager import NavigationManager
from runtime.offline_manager import OfflineManager
from runtime.page_tracker import PageTracker
from runtime.queue_manager import QueueManager, PRIORITY_CRITICAL, PRIORITY_NORMAL
from runtime.replay_manager import ReplayManager
from runtime.session_manager import SessionManager
from runtime.visit_manager import VisitManager
from utils.cache_manager import CacheManager
from utils.dialogue_loader import DialogueLoader
from utils.scheduler import Scheduler
from voice.engine import VoiceEngine

_log = get_logger("runtime.runtime_manager")

# Background task intervals
_CACHE_CLEANUP_INTERVAL_S = 300     # 5 minutes
_INDEX_REFRESH_INTERVAL_S = 600     # 10 minutes


class RuntimeManager:
    """
    Top-level runtime controller.

    Instantiate once at application startup and call ``start()``.
    All subsystems are accessible as properties.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._started = False

        # ── Shared utilities ──────────────────────────────────────────────────
        self._cache_manager = CacheManager()
        self._dialogue_loader = DialogueLoader(cache_manager=self._cache_manager)
        self._scheduler = Scheduler(cooldown_seconds=5.0, max_daily_plays=0)

        # ── Runtime subsystems ────────────────────────────────────────────────
        self._event_dispatcher = EventDispatcher()
        self._session_manager = SessionManager()
        self._condition_manager = ConditionManager()
        self._visit_manager = VisitManager()
        self._page_tracker = PageTracker()
        self._queue_manager = QueueManager()
        self._replay_manager = ReplayManager()
        self._offline_manager = OfflineManager(
            event_dispatcher=self._event_dispatcher,
            session_manager=self._session_manager,
            condition_manager=self._condition_manager,
        )
        self._error_manager = ErrorManager(
            event_dispatcher=self._event_dispatcher,
        )
        self._voice_engine = VoiceEngine()
        self._avatar_controller = AvatarController()
        self._dialogue_runtime = DialogueRuntime(
            event_dispatcher=self._event_dispatcher,
            session_manager=self._session_manager,
            queue_manager=self._queue_manager,
            visit_manager=self._visit_manager,
            condition_manager=self._condition_manager,
            replay_manager=self._replay_manager,
            error_manager=self._error_manager,
            offline_manager=self._offline_manager,
            scheduler=self._scheduler,
            dialogue_loader=self._dialogue_loader,
            voice_engine=self._voice_engine,
            avatar_controller=self._avatar_controller,
        )
        self._navigation_manager = NavigationManager(
            page_tracker=self._page_tracker,
            session_manager=self._session_manager,
            visit_manager=self._visit_manager,
            event_dispatcher=self._event_dispatcher,
            dialogue_runtime=self._dialogue_runtime,
            condition_manager=self._condition_manager,
        )

        # ── Register background tasks ─────────────────────────────────────────
        self._scheduler.add_task(
            name="cache_cleanup",
            callback=self._cache_manager.clear_expired,
            interval_s=_CACHE_CLEANUP_INTERVAL_S,
        )

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Initialise all subsystems and dispatch session_started event."""
        with self._lock:
            if self._started:
                _log.warning("RuntimeManager already started.")
                return
            self._started = True

        self._scheduler.start()
        self._event_dispatcher.dispatch(
            "session_started",
            {"session_id": self._session_manager.session_id},
        )
        _log.info(
            "RuntimeManager started | session=%s",
            self._session_manager.session_id,
        )

    def stop(self) -> None:
        """Stop all subsystems and dispatch session_ended event."""
        with self._lock:
            if not self._started:
                return
            self._started = False

        self._scheduler.stop()
        self._dialogue_runtime.stop()  # calls DialogueRuntime.stop()
        self._queue_manager.cancel_all()
        self._event_dispatcher.dispatch(
            "session_ended",
            {"session_id": self._session_manager.session_id},
        )
        _log.info("RuntimeManager stopped.")

    # Alias for explicit shutdown
    shutdown = stop

    # ── Navigation ────────────────────────────────────────────────────────────

    def open_page(self, page: str, language: Optional[str] = None) -> dict[str, Any]:
        """
        Navigate to *page* and trigger the appropriate welcome dialogue.

        Parameters
        ----------
        page     : page identifier
        language : override language for this page (uses session language if None)

        Returns
        -------
        dict with navigation result and dialogue result
        """
        return self._navigation_manager.open_page(page, language)

    def close_page(self, page: str) -> dict[str, Any]:
        """Close *page* and record time spent."""
        return self._navigation_manager.close_page(page)

    # ── Dialogue control ──────────────────────────────────────────────────────

    def play(
        self,
        page: str,
        dialogue_type: str = "welcome",
        language: Optional[str] = None,
        priority: int = PRIORITY_NORMAL,
        context: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Enqueue and play a dialogue."""
        return self._dialogue_runtime.play(
            page, dialogue_type, language, priority, context
        )

    def pause(self) -> dict[str, Any]:
        """Pause the currently playing dialogue."""
        return self._dialogue_runtime.pause()

    def resume(self) -> dict[str, Any]:
        """Resume a paused dialogue."""
        return self._dialogue_runtime.resume()

    def stop(self) -> dict[str, Any]:
        """Stop the current dialogue."""
        return self._dialogue_runtime.stop()

    def replay(self, dialogue_id: Optional[str] = None) -> dict[str, Any]:
        """Replay the last or a specific dialogue."""
        return self._dialogue_runtime.replay(dialogue_id)

    def skip(self) -> dict[str, Any]:
        """Skip the current dialogue."""
        return self._dialogue_runtime.skip()

    # ── Language ──────────────────────────────────────────────────────────────

    def set_language(self, language: str) -> dict[str, Any]:
        """
        Change the active language across the entire runtime.

        RC-4 FIX: Guard against no-op language changes.  If the requested
        language is already the current language, return immediately without
        dispatching language_changed or calling set_language on subsystems.
        This prevents the rj/mewati → en → rj/mewati triple-fire that
        occurred when /conditions, /language, and /page all ran in parallel
        during /initialize.
        """
        old_language = self._session_manager.current_language
        if old_language == language:
            _log.debug("set_language: no-op, already '%s'", language)
            return {"success": True, "operation": "set_language", "language": language}
        self._session_manager.set_language(language)
        self._condition_manager.set("language", language)
        self._cache_manager.invalidate_language(old_language)
        result = self._dialogue_runtime.set_language(language)
        self._event_dispatcher.language_changed(old_language, language)
        _log.info("Language changed: %s → %s", old_language, language)
        return result

    # ── Connectivity ──────────────────────────────────────────────────────────

    def set_online(self, online: bool) -> None:
        """Notify the runtime of connectivity change."""
        if online:
            self._offline_manager.go_online()
        else:
            self._offline_manager.go_offline()

    # ── Condition context ─────────────────────────────────────────────────────

    def update_conditions(self, data: dict[str, Any]) -> None:
        """Bulk-update runtime condition context (login state, permissions, etc.)."""
        self._condition_manager.update(data)

    # ── Scheduler ─────────────────────────────────────────────────────────────

    def can_play(self, page: str, dialogue_type: str) -> bool:
        """Return True if the dialogue is allowed to play (cooldown check)."""
        return self._scheduler.can_play(page, dialogue_type)

    def record_play(self, page: str, dialogue_type: str) -> None:
        """Record that a dialogue was played (updates cooldown timer)."""
        self._scheduler.record_play(page, dialogue_type)

    # ── Status ────────────────────────────────────────────────────────────────

    def get_status(self) -> dict[str, Any]:
        """Return a full snapshot of the runtime state."""
        return {
            "started": self._started,
            "session": self._session_manager.snapshot(),
            "current_page": self._page_tracker.current_page,
            "previous_page": self._page_tracker.previous_page,
            "queue_size": self._queue_manager.size(),
            "is_online": self._session_manager.is_online,
            "dialogue_runtime": self._dialogue_runtime.get_status(),
            "conditions": self._condition_manager.get_context(),
            "cache_stats": self._cache_manager.stats(),
            "offline": self._offline_manager.get_status(),
            "events": self._event_dispatcher.get_history(),
        }

    # ── Subsystem accessors ───────────────────────────────────────────────────

    @property
    def dialogue_runtime(self) -> DialogueRuntime:
        return self._dialogue_runtime

    @property
    def navigation_manager(self) -> NavigationManager:
        return self._navigation_manager

    @property
    def page_tracker(self) -> PageTracker:
        return self._page_tracker

    @property
    def event_dispatcher(self) -> EventDispatcher:
        return self._event_dispatcher

    @property
    def replay_manager(self) -> ReplayManager:
        return self._replay_manager

    @property
    def visit_manager(self) -> VisitManager:
        return self._visit_manager

    @property
    def condition_manager(self) -> ConditionManager:
        return self._condition_manager

    @property
    def queue_manager(self) -> QueueManager:
        return self._queue_manager

    @property
    def session_manager(self) -> SessionManager:
        return self._session_manager

    @property
    def offline_manager(self) -> OfflineManager:
        return self._offline_manager

    @property
    def error_manager(self) -> ErrorManager:
        return self._error_manager

    @property
    def scheduler(self) -> Scheduler:
        return self._scheduler

    @property
    def cache_manager(self) -> CacheManager:
        return self._cache_manager

    @property
    def dialogue_loader(self) -> DialogueLoader:
        return self._dialogue_loader

    def __repr__(self) -> str:
        return (
            f"RuntimeManager(started={self._started}, "
            f"session={self._session_manager.session_id!r})"
        )
