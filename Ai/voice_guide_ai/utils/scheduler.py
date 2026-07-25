"""
Voice Guide AI — Scheduler.

Provides:
  * 24-hour rule: prevent the same dialogue from playing more than
    once per day per page (configurable cooldown)
  * Cooldown timers: enforce minimum gap between dialogue plays
  * Periodic task runner: background tasks (cache cleanup, index refresh)
  * Thread-safe

Used by the runtime to enforce dialogue frequency rules and run
background maintenance tasks.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("utils.scheduler")

_DEFAULT_COOLDOWN_S = 5.0       # minimum seconds between same dialogue plays
_DAILY_RESET_HOUR = 0           # midnight local time resets daily counters


@dataclass
class PlayRecord:
    """Tracks when a dialogue was last played."""
    dialogue_key: str           # "{page}:{dialogue_type}"
    last_played_at: float       # monotonic time
    last_played_date: str       # YYYY-MM-DD
    play_count_today: int = 1

    def is_on_cooldown(self, cooldown_s: float) -> bool:
        return (time.monotonic() - self.last_played_at) < cooldown_s

    def was_played_today(self) -> bool:
        return self.last_played_date == Helper.current_date()


@dataclass
class ScheduledTask:
    """A periodic background task."""
    name: str
    callback: Callable[[], None]
    interval_s: float
    last_run: float = field(default_factory=time.monotonic)
    enabled: bool = True
    run_count: int = 0

    def is_due(self) -> bool:
        return self.enabled and (time.monotonic() - self.last_run) >= self.interval_s

    def mark_run(self) -> None:
        self.last_run = time.monotonic()
        self.run_count += 1


class Scheduler:
    """
    Dialogue frequency enforcer and periodic task runner.

    Parameters
    ----------
    cooldown_seconds : minimum gap between plays of the same dialogue
    max_daily_plays  : maximum times a dialogue can play per day (0 = unlimited)
    """

    def __init__(
        self,
        cooldown_seconds: float = _DEFAULT_COOLDOWN_S,
        max_daily_plays: int = 0,
    ) -> None:
        self._cooldown_s = cooldown_seconds
        self._max_daily = max_daily_plays
        self._records: dict[str, PlayRecord] = {}
        self._tasks: list[ScheduledTask] = []
        self._lock = threading.Lock()
        self._task_thread: Optional[threading.Thread] = None
        self._running = False

    # ── Cooldown / 24-hour rule ───────────────────────────────────────────────

    def can_play(self, page: str, dialogue_type: str) -> bool:
        """
        Return True if the dialogue is allowed to play now.

        Checks:
          1. Cooldown: minimum gap since last play
          2. Daily limit: max plays per day (if configured)
        """
        key = f"{page}:{dialogue_type}"
        with self._lock:
            record = self._records.get(key)
            if record is None:
                return True

            if record.is_on_cooldown(self._cooldown_s):
                _log.debug(
                    "Cooldown active: %s (%.1fs remaining)",
                    key,
                    self._cooldown_s - (time.monotonic() - record.last_played_at),
                )
                return False

            if self._max_daily > 0 and record.was_played_today():
                if record.play_count_today >= self._max_daily:
                    _log.debug(
                        "Daily limit reached: %s (%d/%d)",
                        key, record.play_count_today, self._max_daily,
                    )
                    return False

        return True

    def record_play(self, page: str, dialogue_type: str) -> None:
        """Record that a dialogue was played now."""
        key = f"{page}:{dialogue_type}"
        today = Helper.current_date()
        now = time.monotonic()

        with self._lock:
            record = self._records.get(key)
            if record is None:
                self._records[key] = PlayRecord(
                    dialogue_key=key,
                    last_played_at=now,
                    last_played_date=today,
                    play_count_today=1,
                )
            else:
                if record.last_played_date != today:
                    record.play_count_today = 1
                    record.last_played_date = today
                else:
                    record.play_count_today += 1
                record.last_played_at = now

        _log.debug("Play recorded: %s", key)

    def cooldown_remaining(self, page: str, dialogue_type: str) -> float:
        """Return seconds remaining on cooldown, or 0.0 if not on cooldown."""
        key = f"{page}:{dialogue_type}"
        with self._lock:
            record = self._records.get(key)
            if record is None:
                return 0.0
            elapsed = time.monotonic() - record.last_played_at
            remaining = self._cooldown_s - elapsed
            return max(0.0, remaining)

    def reset_page(self, page: str) -> int:
        """Reset all cooldown records for *page*. Returns count reset."""
        prefix = f"{page}:"
        with self._lock:
            keys = [k for k in self._records if k.startswith(prefix)]
            for k in keys:
                del self._records[k]
        _log.debug("Cooldown reset for page=%s (%d records)", page, len(keys))
        return len(keys)

    def reset_all(self) -> None:
        """Reset all cooldown records."""
        with self._lock:
            self._records.clear()
        _log.debug("All cooldown records reset.")

    def get_play_stats(self, page: str, dialogue_type: str) -> dict[str, Any]:
        """Return play statistics for a dialogue."""
        key = f"{page}:{dialogue_type}"
        with self._lock:
            record = self._records.get(key)
            if record is None:
                return {"key": key, "played_today": False, "play_count_today": 0}
            return {
                "key": key,
                "played_today": record.was_played_today(),
                "play_count_today": record.play_count_today,
                "on_cooldown": record.is_on_cooldown(self._cooldown_s),
                "cooldown_remaining_s": self.cooldown_remaining(page, dialogue_type),
            }

    # ── Periodic tasks ────────────────────────────────────────────────────────

    def add_task(
        self,
        name: str,
        callback: Callable[[], None],
        interval_s: float,
    ) -> None:
        """Register a periodic background task."""
        with self._lock:
            self._tasks.append(ScheduledTask(
                name=name,
                callback=callback,
                interval_s=interval_s,
            ))
        _log.debug("Task registered: %s (every %.0fs)", name, interval_s)

    def remove_task(self, name: str) -> bool:
        """Remove a task by name. Returns True if found."""
        with self._lock:
            before = len(self._tasks)
            self._tasks = [t for t in self._tasks if t.name != name]
            return len(self._tasks) < before

    def start(self) -> None:
        """Start the background task runner thread."""
        if self._running:
            return
        self._running = True
        self._task_thread = threading.Thread(
            target=self._task_loop, daemon=True, name="scheduler"
        )
        self._task_thread.start()
        _log.debug("Scheduler started.")

    def stop(self) -> None:
        """Stop the background task runner."""
        self._running = False
        _log.debug("Scheduler stopped.")

    def run_due_tasks(self) -> int:
        """Run all due tasks synchronously. Returns count run."""
        ran = 0
        with self._lock:
            tasks = list(self._tasks)
        for task in tasks:
            if task.is_due():
                try:
                    task.callback()
                    task.mark_run()
                    ran += 1
                    _log.debug("Task ran: %s", task.name)
                except Exception as exc:
                    _log.warning("Task error [%s]: %s", task.name, exc)
        return ran

    # ── Internal ──────────────────────────────────────────────────────────────

    def _task_loop(self) -> None:
        while self._running:
            time.sleep(1.0)
            self.run_due_tasks()
