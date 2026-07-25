"""
Voice Guide AI — Batch MP3 Generator.

Reads all translation files via TextLoader and generates MP3s in parallel
using EdgeTTSGenerator.  Cache-first: skips files that already exist and
are valid.  Writes generation results to metadata/generation_log.json and
updates metadata/audio_index.json.
"""

from __future__ import annotations

import datetime
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config.logger import get_logger
from voice.generators.edge_tts import EdgeTTSGenerator, GenerationResult
from voice.generators.text_loader import TextLoader, TextRecord
from voice.utils.file_utils import FileUtils

_log = get_logger("voice.generators.batch_generator")

_DEFAULT_WORKERS = 4
_METADATA_DIR = Path("voice") / "metadata"
_CONFIGS_DIR = Path("voice") / "configs"


@dataclass
class BatchStats:
    session_id: str
    started_at: str
    finished_at: str = ""
    total: int = 0
    generated: int = 0
    cached: int = 0
    failed: int = 0
    skipped: int = 0
    duration_s: float = 0.0
    errors: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "total": self.total,
            "generated": self.generated,
            "cached": self.cached,
            "failed": self.failed,
            "skipped": self.skipped,
            "duration_s": round(self.duration_s, 2),
            "errors": self.errors,
        }


class BatchGenerator:
    """
    Parallel batch MP3 generator.

    Parameters
    ----------
    base_dir     : absolute path to voice_guide_ai/ package root
    max_workers  : number of parallel generation threads
    languages    : restrict to these language codes; None = all
    modules      : restrict to these module names; None = all
    force        : regenerate even if cached files exist
    """

    def __init__(
        self,
        base_dir: Path,
        max_workers: int = _DEFAULT_WORKERS,
        languages: Optional[list[str]] = None,
        modules: Optional[list[str]] = None,
        force: bool = False,
    ) -> None:
        self._base = base_dir
        self._max_workers = max_workers
        self._languages = languages
        self._modules = modules
        self._force = force
        self._generator = EdgeTTSGenerator(
            base_dir=base_dir,
            configs_dir=base_dir / _CONFIGS_DIR,
        )
        self._index_lock = threading.Lock()

    # ── Public API ────────────────────────────────────────────────────────────

    def run(self) -> BatchStats:
        """
        Load all translations and generate missing MP3s in parallel.

        Returns a BatchStats summary.
        """
        import time
        session_id = str(uuid.uuid4())[:8]
        started_at = datetime.datetime.now().isoformat()
        t0 = time.perf_counter()

        stats = BatchStats(session_id=session_id, started_at=started_at)

        loader = TextLoader(
            translations_dir=self._base / "translations",
            languages=self._languages,
            modules=self._modules,
        )
        records = loader.load_all()
        stats.total = len(records)
        _log.info("Batch generation started | session=%s | records=%d", session_id, stats.total)

        audio_index = self._load_audio_index()
        results: list[GenerationResult] = []

        with ThreadPoolExecutor(max_workers=self._max_workers, thread_name_prefix="tts") as pool:
            futures = {
                pool.submit(self._generate_one, record): record
                for record in records
            }
            for future in as_completed(futures):
                record = futures[future]
                try:
                    result = future.result()
                except Exception as exc:
                    _log.error("Unexpected error for %s: %s", record.cache_key(), exc)
                    result = GenerationResult(
                        success=False,
                        language=record.language,
                        module=record.module,
                        dialogue_id=record.dialogue_id,
                        error=str(exc),
                    )

                results.append(result)
                if result.success:
                    if result.cached:
                        stats.cached += 1
                    else:
                        stats.generated += 1
                    with self._index_lock:
                        audio_index["entries"][result.path] = {
                            "language": result.language,
                            "module": result.module,
                            "dialogue_id": result.dialogue_id,
                            "duration_s": result.duration_s,
                            "size_bytes": result.size_bytes,
                            "checksum": result.checksum,
                            "cached": result.cached,
                        }
                else:
                    stats.failed += 1
                    stats.errors.append({
                        "key": record.cache_key(),
                        "error": result.error,
                    })

        stats.duration_s = time.perf_counter() - t0
        stats.finished_at = datetime.datetime.now().isoformat()

        audio_index["total_files"] = len(audio_index["entries"])
        audio_index["generated_at"] = stats.finished_at
        self._save_audio_index(audio_index)
        self._append_generation_log(stats)

        _log.info(
            "Batch done | session=%s | generated=%d cached=%d failed=%d | %.1fs",
            session_id, stats.generated, stats.cached, stats.failed, stats.duration_s,
        )
        self._generator.shutdown()
        return stats

    def generate_language(self, language: str) -> BatchStats:
        """Generate all MP3s for a single language."""
        self._languages = [language]
        return self.run()

    def generate_module(self, language: str, module: str) -> BatchStats:
        """Generate all MP3s for a single language/module pair."""
        self._languages = [language]
        self._modules = [module]
        return self.run()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _generate_one(self, record: TextRecord) -> GenerationResult:
        return self._generator.generate(
            language=record.language,
            module=record.module,
            dialogue_id=record.dialogue_id,
            text=record.text,
            force=self._force,
        )

    def _load_audio_index(self) -> dict:
        path = self._base / _METADATA_DIR / "audio_index.json"
        data = FileUtils.read_json(path, default=None)
        if not isinstance(data, dict) or "entries" not in data:
            return {"version": "1.0.0", "generated_at": "", "total_files": 0, "entries": {}}
        return data

    def _save_audio_index(self, data: dict) -> None:
        path = self._base / _METADATA_DIR / "audio_index.json"
        FileUtils.write_json(path, data)

    def _append_generation_log(self, stats: BatchStats) -> None:
        path = self._base / _METADATA_DIR / "generation_log.json"
        log_data = FileUtils.read_json(path, default={"version": "1.0.0", "sessions": []})
        if not isinstance(log_data, dict):
            log_data = {"version": "1.0.0", "sessions": []}
        sessions = log_data.get("sessions", [])
        sessions.append(stats.to_dict())
        # Keep last 100 sessions
        log_data["sessions"] = sessions[-100:]
        FileUtils.write_json(path, log_data)
