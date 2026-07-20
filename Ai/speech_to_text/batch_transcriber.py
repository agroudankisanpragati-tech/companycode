# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/batch_transcriber.py
# Purpose: Batch-transcribes every audio file in a folder using Faster-Whisper.
#
# Output layout (all under speech_to_text/outputs/):
#   transcripts/          <stem>.txt   — plain transcript
#   json/                 <stem>.json  — full structured result
#   transcription_logs/   batch_<run_id>.log   — per-run machine log
#                         batch_summary_<run_id>.json — final summary
#
# Features:
#   - Resume mode  : reads manifest; skips files already marked "completed"
#   - Multi-thread : ThreadPoolExecutor, configurable worker count
#   - Progress bar : live console bar with ETA (no third-party deps)
#   - Fault-tolerant: exceptions per file are caught; batch continues
#   - WER field    : placeholder stored in summary (requires reference text)
# =============================================================================

from __future__ import annotations

import json
import logging
import sys
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from speech_to_text.config import STTConfig, get_config, SUPPORTED_AUDIO_EXTENSIONS

# TranscriptionResult is imported lazily inside methods to avoid pulling
# soundfile/faster_whisper at module import time (they may not be installed).
# The type annotation below is a string forward-reference for the same reason.
_TranscriptionResult = None   # resolved on first use

# =============================================================================
# CONSTANTS
# =============================================================================

_STATUS_COMPLETED = "completed"
_STATUS_FAILED    = "failed"
_STATUS_SKIPPED   = "skipped"
_STATUS_PENDING   = "pending"

_MANIFEST_NAME    = "batch_manifest.json"   # resume state, lives in outputs/


# =============================================================================
# DATACLASSES
# =============================================================================

@dataclass
class FileRecord:
    """Per-file processing record stored in the manifest and final summary."""
    file_name:            str
    file_path:            str
    status:               str          # pending | completed | failed | skipped
    transcript_txt:       str  = ""    # path to .txt output
    transcript_json:      str  = ""    # path to .json output
    language:             str  = ""
    language_probability: float = 0.0
    duration_s:           float = 0.0
    processing_time_s:    float = 0.0
    segment_count:        int   = 0
    wer:                  Optional[float] = None   # placeholder; None until ref provided
    error:                str  = ""
    completed_at:         str  = ""


@dataclass
class BatchResult:
    """Aggregate result returned by BatchTranscriber.run()."""
    run_id:               str
    input_folder:         str
    model_size:           str
    total_files:          int
    completed:            int
    skipped:              int
    failed:               int
    total_audio_s:        float
    total_processing_s:   float
    realtime_factor:      float          # total_audio_s / total_processing_s
    started_at:           str
    finished_at:          str
    summary_json_path:    str
    records:              list[FileRecord] = field(default_factory=list)


# =============================================================================
# LOGGER
# =============================================================================

def _build_logger(cfg: STTConfig, log_path: Path) -> logging.Logger:
    name = f"akp.stt.batch.{log_path.stem}"
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, cfg.log_level.upper(), logging.INFO))
    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

    log_path.parent.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(
        filename=log_path,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# =============================================================================
# PROGRESS BAR  (stdlib-only, Windows-safe)
# =============================================================================

class _ProgressBar:
    """
    Thread-safe console progress bar with ETA.
    Writes to stderr so it does not pollute stdout log captures.
    """

    _WIDTH = 40

    def __init__(self, total: int) -> None:
        self._total     = max(total, 1)
        self._done      = 0
        self._lock      = threading.Lock()
        self._start     = time.monotonic()

    def advance(self, label: str = "") -> None:
        with self._lock:
            self._done += 1
            done  = self._done
            total = self._total
            elapsed = time.monotonic() - self._start
            rate    = done / elapsed if elapsed > 0 else 0.0
            eta_s   = (total - done) / rate if rate > 0 else 0.0
            filled  = int(self._WIDTH * done / total)
            bar     = "█" * filled + "░" * (self._WIDTH - filled)
            pct     = 100 * done / total
            eta_str = _fmt_duration(eta_s)
            line    = (
                f"\r  [{bar}] {pct:5.1f}%  {done}/{total}"
                f"  ETA {eta_str}"
                f"  {label[:40]:<40}"
            )
            sys.stderr.write(line)
            sys.stderr.flush()
            if done >= total:
                sys.stderr.write("\n")
                sys.stderr.flush()


def _fmt_duration(seconds: float) -> str:
    seconds = int(seconds)
    h, rem  = divmod(seconds, 3600)
    m, s    = divmod(rem, 60)
    if h:
        return f"{h}h{m:02d}m{s:02d}s"
    if m:
        return f"{m}m{s:02d}s"
    return f"{s}s"


# =============================================================================
# OUTPUT WRITERS
# =============================================================================

def _write_txt(out_dir: Path, stem: str, result) -> Path:
    """Writes a plain-text transcript with segment timestamps."""
    path = out_dir / f"{stem}.txt"
    lines: list[str] = [
        f"# AKP STT Transcript",
        f"# File    : {result.source_path.name}",
        f"# Language: {result.language} ({result.language_probability * 100:.1f}%)",
        f"# Duration: {result.duration_s:.2f}s",
        f"# Model   : {result.model_size}",
        f"# Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
    ]
    for seg in result.segments:
        lines.append(f"[{seg.start:.2f}s --> {seg.end:.2f}s]  {seg.text}")
    lines.append("")
    lines.append(result.text)
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def _write_json(out_dir: Path, stem: str, result) -> Path:
    """Writes the full structured transcription result as JSON."""
    path = out_dir / f"{stem}.json"
    payload = {
        "file":                 result.source_path.name,
        "file_path":            str(result.source_path),
        "language":             result.language,
        "language_probability": result.language_probability,
        "duration_s":           result.duration_s,
        "transcription_time_s": result.transcription_time_s,
        "model_size":           result.model_size,
        "text":                 result.text,
        "segments": [
            {
                "id":         seg.id,
                "start":      seg.start,
                "end":        seg.end,
                "text":       seg.text,
                "confidence": seg.confidence,
                "words":      seg.words,
            }
            for seg in result.segments
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


# =============================================================================
# MANIFEST  (resume state)
# =============================================================================

def _load_manifest(manifest_path: Path) -> dict[str, str]:
    """
    Returns {file_name: status} from an existing manifest.
    Returns empty dict if the manifest does not exist or is corrupt.
    """
    if not manifest_path.exists():
        return {}
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        return {entry["file_name"]: entry["status"] for entry in data if "file_name" in entry}
    except Exception:
        return {}


def _save_manifest(manifest_path: Path, records: list[FileRecord]) -> None:
    """Atomically overwrites the manifest with current record states."""
    tmp = manifest_path.with_suffix(".tmp")
    tmp.write_text(
        json.dumps([asdict(r) for r in records], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp.replace(manifest_path)


# =============================================================================
# BATCH TRANSCRIBER
# =============================================================================

class BatchTranscriber:
    """
    Transcribes all audio files in a folder using a thread pool.

    Resume mode (resume=True, default):
        Reads the manifest from outputs/batch_manifest.json.
        Files already marked "completed" are skipped without re-processing.

    Usage:
        bt = BatchTranscriber()
        result = bt.run("/path/to/audio/folder")
        print(result.completed, result.failed, result.skipped)
    """

    def __init__(
        self,
        model_size:   Optional[str] = None,
        cfg:          Optional[STTConfig] = None,
        max_workers:  int  = 2,
        language:     Optional[str] = None,
        word_timestamps: bool = False,
        vad_filter:   bool = True,
    ) -> None:
        self._cfg          = cfg or get_config()
        self._model_size   = model_size or self._cfg.default_model
        self._max_workers  = max(1, max_workers)
        self._language     = language
        self._word_ts      = word_timestamps
        self._vad          = vad_filter

        # Output directories
        self._out_root     = self._cfg.outputs_dir
        self._dir_txt      = self._out_root / "transcripts"
        self._dir_json     = self._out_root / "json"
        self._dir_logs     = self._out_root / "transcription_logs"
        self._manifest     = self._out_root / _MANIFEST_NAME

        for d in (self._dir_txt, self._dir_json, self._dir_logs):
            d.mkdir(parents=True, exist_ok=True)

        # Run identity
        self._run_id  = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        log_path      = self._dir_logs / f"batch_{self._run_id}.log"
        self._log     = _build_logger(self._cfg, log_path)

        # Transcriber is shared across threads — WhisperModel is thread-safe
        # for read-only inference when using separate Python threads.
        from speech_to_text.transcriber import get_transcriber
        self._transcriber = get_transcriber(self._model_size)

        # Manifest lock — protects concurrent writes to the manifest file
        self._manifest_lock = threading.Lock()

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def run(
        self,
        input_folder: str | Path,
        resume: bool = True,
    ) -> BatchResult:
        """
        Transcribes all supported audio files found in input_folder.

        Args:
            input_folder: Directory containing audio files (searched recursively).
            resume:       Skip files already marked "completed" in the manifest.

        Returns:
            BatchResult: Aggregate statistics and per-file records.

        Raises:
            NotADirectoryError: If input_folder does not exist or is not a directory.
        """
        folder = Path(input_folder).resolve()
        if not folder.is_dir():
            raise NotADirectoryError(f"Input folder not found or not a directory: {folder}")

        started_at = datetime.now(timezone.utc).isoformat()
        self._log.info("=" * 60)
        self._log.info("Batch run %s started", self._run_id)
        self._log.info("Input folder : %s", folder)
        self._log.info("Model        : %s", self._model_size)
        self._log.info("Workers      : %d", self._max_workers)
        self._log.info("Resume       : %s", resume)

        audio_files = sorted(
            p for p in folder.rglob("*")
            if p.is_file() and p.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS
        )

        if not audio_files:
            self._log.warning("No supported audio files found in %s", folder)
            return self._empty_result(str(folder), started_at)

        self._log.info("Discovered %d audio file(s)", len(audio_files))

        prior = _load_manifest(self._manifest) if resume else {}
        records = self._build_records(audio_files, prior)

        pending   = [r for r in records if r.status == _STATUS_PENDING]
        skipped   = [r for r in records if r.status == _STATUS_SKIPPED]

        self._log.info(
            "Pending: %d  |  Skipped (resume): %d",
            len(pending), len(skipped),
        )

        bar = _ProgressBar(len(pending))
        t_batch_start = time.perf_counter()

        with ThreadPoolExecutor(max_workers=self._max_workers) as pool:
            futures = {
                pool.submit(self._process_file, rec): rec
                for rec in pending
            }
            for future in as_completed(futures):
                rec = futures[future]
                try:
                    future.result()
                except Exception as exc:
                    # Should not reach here — _process_file catches internally,
                    # but guard against unexpected executor-level errors.
                    rec.status = _STATUS_FAILED
                    rec.error  = f"Executor error: {exc}"
                    self._log.error("Executor error for '%s': %s", rec.file_name, exc)
                finally:
                    bar.advance(rec.file_name)
                    with self._manifest_lock:
                        _save_manifest(self._manifest, records)

        total_processing_s = time.perf_counter() - t_batch_start
        finished_at        = datetime.now(timezone.utc).isoformat()

        completed_recs = [r for r in records if r.status == _STATUS_COMPLETED]
        failed_recs    = [r for r in records if r.status == _STATUS_FAILED]
        skipped_recs   = [r for r in records if r.status == _STATUS_SKIPPED]

        total_audio_s = sum(r.duration_s for r in completed_recs)
        rtf = total_audio_s / total_processing_s if total_processing_s > 0 else 0.0

        summary_path = self._write_summary(
            records, str(folder), started_at, finished_at,
            total_audio_s, total_processing_s, rtf,
        )

        self._log.info("-" * 60)
        self._log.info(
            "Batch complete | completed=%d  skipped=%d  failed=%d",
            len(completed_recs), len(skipped_recs), len(failed_recs),
        )
        self._log.info("Total audio   : %.2fs", total_audio_s)
        self._log.info("Processing    : %.2fs", total_processing_s)
        self._log.info("Realtime factor: %.2fx", rtf)
        self._log.info("Summary       : %s", summary_path)
        self._log.info("=" * 60)

        return BatchResult(
            run_id              = self._run_id,
            input_folder        = str(folder),
            model_size          = self._model_size,
            total_files         = len(records),
            completed           = len(completed_recs),
            skipped             = len(skipped_recs),
            failed              = len(failed_recs),
            total_audio_s       = round(total_audio_s, 4),
            total_processing_s  = round(total_processing_s, 4),
            realtime_factor     = round(rtf, 4),
            started_at          = started_at,
            finished_at         = finished_at,
            summary_json_path   = str(summary_path),
            records             = records,
        )

    # ------------------------------------------------------------------
    # INTERNAL — per-file worker
    # ------------------------------------------------------------------

    def _process_file(self, rec: FileRecord) -> None:
        """
        Transcribes a single file and writes .txt + .json outputs.
        All exceptions are caught; rec.status is set to "failed" on error.
        Never raises — the batch always continues.
        """
        t0 = time.perf_counter()
        self._log.info("Processing: %s", rec.file_name)

        try:
            result = self._transcriber.transcribe(
                rec.file_path,
                language=self._language,
                word_timestamps=self._word_ts,
                vad_filter=self._vad,
            )

            stem     = Path(rec.file_path).stem
            txt_path = _write_txt(self._dir_txt, stem, result)
            jsn_path = _write_json(self._dir_json, stem, result)

            elapsed = time.perf_counter() - t0

            rec.status               = _STATUS_COMPLETED
            rec.transcript_txt       = str(txt_path)
            rec.transcript_json      = str(jsn_path)
            rec.language             = result.language
            rec.language_probability = result.language_probability
            rec.duration_s           = result.duration_s
            rec.processing_time_s    = round(elapsed, 4)
            rec.segment_count        = len(result.segments)
            rec.wer                  = None   # placeholder — no reference text
            rec.completed_at         = datetime.now(timezone.utc).isoformat()

            self._log.info(
                "  ✓ %s | lang=%s | %.2fs audio | %.2fs proc | %d segs",
                rec.file_name, rec.language, rec.duration_s,
                rec.processing_time_s, rec.segment_count,
            )

        except Exception as exc:
            elapsed       = time.perf_counter() - t0
            rec.status    = _STATUS_FAILED
            rec.error     = str(exc)
            rec.processing_time_s = round(elapsed, 4)
            self._log.error(
                "  ✗ %s | %.2fs | %s",
                rec.file_name, elapsed, exc,
            )
            self._log.debug(traceback.format_exc())

    # ------------------------------------------------------------------
    # INTERNAL — helpers
    # ------------------------------------------------------------------

    def _build_records(
        self,
        audio_files: list[Path],
        prior: dict[str, str],
    ) -> list[FileRecord]:
        """
        Builds the initial FileRecord list.
        Files whose prior status is "completed" are marked skipped.
        """
        records: list[FileRecord] = []
        for path in audio_files:
            prior_status = prior.get(path.name, _STATUS_PENDING)
            status = _STATUS_SKIPPED if prior_status == _STATUS_COMPLETED else _STATUS_PENDING
            records.append(FileRecord(
                file_name = path.name,
                file_path = str(path),
                status    = status,
            ))
        return records

    def _write_summary(
        self,
        records:            list[FileRecord],
        input_folder:       str,
        started_at:         str,
        finished_at:        str,
        total_audio_s:      float,
        total_processing_s: float,
        rtf:                float,
    ) -> Path:
        """Writes batch_summary_<run_id>.json to transcription_logs/."""
        completed = [r for r in records if r.status == _STATUS_COMPLETED]
        failed    = [r for r in records if r.status == _STATUS_FAILED]
        skipped   = [r for r in records if r.status == _STATUS_SKIPPED]

        payload = {
            "run_id":              self._run_id,
            "input_folder":        input_folder,
            "model_size":          self._model_size,
            "started_at":          started_at,
            "finished_at":         finished_at,
            "total_files":         len(records),
            "completed":           len(completed),
            "skipped":             len(skipped),
            "failed":              len(failed),
            "total_audio_s":       round(total_audio_s, 4),
            "total_processing_s":  round(total_processing_s, 4),
            "realtime_factor":     round(rtf, 4),
            "wer_note":            "WER not computed — no reference transcripts provided.",
            "failures": [
                {"file": r.file_name, "error": r.error}
                for r in failed
            ],
            "skipped_files": [r.file_name for r in skipped],
            "completed_files": [
                {
                    "file":                 r.file_name,
                    "language":             r.language,
                    "language_probability": r.language_probability,
                    "duration_s":           r.duration_s,
                    "processing_time_s":    r.processing_time_s,
                    "segment_count":        r.segment_count,
                    "wer":                  r.wer,
                    "transcript_txt":       r.transcript_txt,
                    "transcript_json":      r.transcript_json,
                    "completed_at":         r.completed_at,
                }
                for r in completed
            ],
        }

        out_path = self._dir_logs / f"batch_summary_{self._run_id}.json"
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return out_path

    def _empty_result(self, folder: str, started_at: str) -> BatchResult:
        finished_at = datetime.now(timezone.utc).isoformat()
        summary_path = self._write_summary([], folder, started_at, finished_at, 0.0, 0.0, 0.0)
        return BatchResult(
            run_id             = self._run_id,
            input_folder       = folder,
            model_size         = self._model_size,
            total_files        = 0,
            completed          = 0,
            skipped            = 0,
            failed             = 0,
            total_audio_s      = 0.0,
            total_processing_s = 0.0,
            realtime_factor    = 0.0,
            started_at         = started_at,
            finished_at        = finished_at,
            summary_json_path  = str(summary_path),
            records            = [],
        )


# =============================================================================
# MODULE-LEVEL CONVENIENCE
# =============================================================================

def run_batch(
    input_folder:    str | Path,
    model_size:      Optional[str] = None,
    resume:          bool = True,
    max_workers:     int  = 2,
    language:        Optional[str] = None,
    word_timestamps: bool = False,
    vad_filter:      bool = True,
) -> "BatchResult":
    """
    One-call entry point for batch transcription.

    Args:
        input_folder:    Directory containing audio files.
        model_size:      Whisper model size (default: STTConfig.default_model).
        resume:          Skip already-completed files (default: True).
        max_workers:     Thread pool size (default: 2).
        language:        Force language code, e.g. 'hi'. None = auto-detect.
        word_timestamps: Include word-level timestamps in JSON output.
        vad_filter:      Apply Silero VAD filter (default: True).

    Returns:
        BatchResult

    Usage:
        from speech_to_text.batch_transcriber import run_batch
        result = run_batch("/data/audio", model_size="small", max_workers=4)
        print(f"Done: {result.completed}  Failed: {result.failed}")
    """
    bt = BatchTranscriber(
        model_size      = model_size,
        max_workers     = max_workers,
        language        = language,
        word_timestamps = word_timestamps,
        vad_filter      = vad_filter,
    )
    return bt.run(input_folder, resume=resume)


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def _cli() -> None:
    """
    Command-line entry point.

    Usage:
        python -m speech_to_text.batch_transcriber [folder] [model_size] [workers]

    When called with no arguments the default input folder is
    speech_to_text/outputs/  (useful for quick smoke-tests).
    """
    import argparse

    parser = argparse.ArgumentParser(
        prog="python -m speech_to_text.batch_transcriber",
        description="AKP STT — Batch audio transcription using Faster-Whisper",
    )
    parser.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Directory containing audio files (default: speech_to_text/outputs/)",
    )
    parser.add_argument(
        "--model", "-m",
        default=None,
        dest="model_size",
        help="Whisper model size: tiny|base|small|medium|large-v3 (default: base)",
    )
    parser.add_argument(
        "--workers", "-w",
        type=int,
        default=2,
        dest="workers",
        help="Thread pool size (default: 2)",
    )
    parser.add_argument(
        "--language", "-l",
        default=None,
        dest="language",
        help="Force language code, e.g. hi, en (default: auto-detect)",
    )
    parser.add_argument(
        "--no-resume",
        action="store_true",
        dest="no_resume",
        help="Ignore resume manifest and re-process all files",
    )
    parser.add_argument(
        "--word-timestamps",
        action="store_true",
        dest="word_timestamps",
        help="Include word-level timestamps in JSON output",
    )
    parser.add_argument(
        "--no-vad",
        action="store_true",
        dest="no_vad",
        help="Disable Silero VAD filter",
    )

    args = parser.parse_args()

    # Resolve input folder
    if args.folder:
        input_folder = Path(args.folder).resolve()
    else:
        # Default: use the STT outputs directory as a demo target
        from speech_to_text.config import get_config as _gc
        input_folder = _gc().outputs_dir
        print(f"  No folder specified — using default: {input_folder}")

    if not input_folder.is_dir():
        print(f"  ERROR: Folder does not exist: {input_folder}")
        sys.exit(1)

    res = run_batch(
        input_folder    = input_folder,
        model_size      = args.model_size,
        max_workers     = args.workers,
        language        = args.language,
        word_timestamps = args.word_timestamps,
        vad_filter      = not args.no_vad,
        resume          = not args.no_resume,
    )

    print("\n" + "=" * 60)
    print("  AKP STT — Batch Transcription Summary")
    print("=" * 60)
    print(f"\n  Run ID      : {res.run_id}")
    print(f"  Input       : {res.input_folder}")
    print(f"  Model       : {res.model_size}")
    print(f"  Total files : {res.total_files}")
    print(f"  Completed   : {res.completed}")
    print(f"  Skipped     : {res.skipped}")
    print(f"  Failed      : {res.failed}")
    print(f"  Audio total : {res.total_audio_s:.2f}s")
    print(f"  Proc time   : {res.total_processing_s:.2f}s")
    print(f"  RT factor   : {res.realtime_factor:.2f}x")
    print(f"  Summary     : {res.summary_json_path}")
    if res.failed:
        print(f"\n  Failed files:")
        for r in res.records:
            if r.status == "failed":
                print(f"    {r.file_name}: {r.error}")
    print("\n" + "=" * 60 + "\n")


if __name__ == "__main__":
    # Ensure the Ai/ directory is on sys.path so that
    # `python -m speech_to_text.batch_transcriber` works from any cwd.
    import os as _os
    _ai_root = Path(__file__).resolve().parent.parent
    if str(_ai_root) not in sys.path:
        sys.path.insert(0, str(_ai_root))
    _cli()
