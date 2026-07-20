# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/dataset_builder.py
# Purpose: Scans every intent folder inside datasets/, reads all supported
#          file formats (JSON, CSV, TXT, DOCX), assigns intent labels from
#          folder names, merges, deduplicates, normalises, shuffles, splits,
#          and writes intent_dataset.json, intent_dataset.csv, and
#          dataset_statistics.json to outputs/.
#
# Pipeline:
#   1. Discover intent folders under datasets/
#   2. For each folder: read all JSON / CSV / TXT / DOCX files
#   3. Assign intent label = folder name
#   4. Merge all samples into one list
#   5. Normalise text (lowercase, collapse whitespace, strip)
#   6. Remove duplicates (exact match on normalised text + intent)
#   7. Shuffle with fixed seed
#   8. Split → train / val / test
#   9. Write intent_dataset.json, intent_dataset.csv, dataset_statistics.json
# =============================================================================

from __future__ import annotations

import csv
import json
import logging
import re
import sys
import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from intent_engine.config import IntentEngineConfig, get_config

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: IntentEngineConfig) -> logging.Logger:
    logger = logging.getLogger("akp.intent.dataset_builder")
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

    log_file = cfg.logs_dir / "dataset_builder.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(
        filename=log_file,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# DATA STRUCTURES
# ---------------------------------------------------------------------------

@dataclass
class IntentSample:
    """A single labelled text sample."""
    text:   str
    intent: str
    source: str = ""   # relative path of the source file


@dataclass
class DatasetSplit:
    """Holds the three dataset splits."""
    train: list[IntentSample] = field(default_factory=list)
    val:   list[IntentSample] = field(default_factory=list)
    test:  list[IntentSample] = field(default_factory=list)


@dataclass
class BuildResult:
    """
    Returned by DatasetBuilder.build().

    Attributes:
        total_raw:       Samples collected before deduplication.
        total_clean:     Samples after dedup + normalisation.
        total_train:     Training split size.
        total_val:       Validation split size.
        total_test:      Test split size.
        per_intent:      {intent: count} after cleaning.
        failed_files:    Files that could not be read.
        output_json:     Path to intent_dataset.json.
        output_csv:      Path to intent_dataset.csv.
        output_stats:    Path to dataset_statistics.json.
        split:           The DatasetSplit object.
    """
    total_raw:    int
    total_clean:  int
    total_train:  int
    total_val:    int
    total_test:   int
    per_intent:   dict[str, int]
    failed_files: list[str]
    output_json:  Path
    output_csv:   Path
    output_stats: Path
    split:        DatasetSplit


# ---------------------------------------------------------------------------
# TEXT NORMALISATION
# ---------------------------------------------------------------------------

def _normalise(text: str) -> str:
    """
    Normalises a text sample:
      1. Unicode NFC normalisation
      2. Lowercase (Latin only — Devanagari is case-insensitive by nature)
      3. Collapse all whitespace (tabs, newlines, multiple spaces) to single space
      4. Strip leading/trailing whitespace

    IMPORTANT: Does NOT strip Devanagari characters or Unicode combining
    characters (matras, anusvara, visarga) — these are essential for Hindi.
    """
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# FILE READERS
# ---------------------------------------------------------------------------

def _read_json(path: Path, intent: str, log: logging.Logger) -> list[IntentSample]:
    """
    Reads a JSON file. Supports three shapes:
      - List of strings:                  ["text1", "text2", ...]
      - List of objects with "text" key:  [{"text": "...", ...}, ...]
      - List of objects with "utterance": [{"utterance": "...", ...}, ...]
      - Object with "samples" / "data" / "utterances" key containing the above
    """
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        log.warning("JSON read failed '%s': %s", path.name, exc)
        raise

    # Unwrap common wrapper keys
    if isinstance(raw, dict):
        for key in ("samples", "data", "utterances", "texts", "examples"):
            if key in raw and isinstance(raw[key], list):
                raw = raw[key]
                break
        else:
            # Try to find any list value
            for v in raw.values():
                if isinstance(v, list):
                    raw = v
                    break
            else:
                raw = []

    samples: list[IntentSample] = []
    rel = str(path.name)
    for item in raw:
        if isinstance(item, str):
            text = item
        elif isinstance(item, dict):
            text = (
                item.get("text")
                or item.get("utterance")
                or item.get("sentence")
                or item.get("query")
                or item.get("input")
                or ""
            )
        else:
            continue
        text = str(text).strip()
        if text:
            samples.append(IntentSample(text=text, intent=intent, source=rel))
    return samples


def _read_csv(path: Path, intent: str, log: logging.Logger) -> list[IntentSample]:
    """
    Reads a CSV file. Looks for a column named:
      text | utterance | sentence | query | input | sample
    Falls back to the first column if none of the above are found.
    """
    try:
        content = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        try:
            content = path.read_text(encoding="latin-1")
        except Exception as exc:
            log.warning("CSV read failed '%s': %s", path.name, exc)
            raise

    samples: list[IntentSample] = []
    rel = str(path.name)
    try:
        reader = csv.DictReader(content.splitlines())
        text_col: Optional[str] = None
        for col in (reader.fieldnames or []):
            if col.lower().strip() in ("text", "utterance", "sentence", "query", "input", "sample"):
                text_col = col
                break

        for row in reader:
            if text_col:
                text = str(row.get(text_col, "")).strip()
            else:
                # Fall back to first column
                values = list(row.values())
                text = str(values[0]).strip() if values else ""
            if text:
                samples.append(IntentSample(text=text, intent=intent, source=rel))
    except Exception as exc:
        log.warning("CSV parse failed '%s': %s", path.name, exc)
        raise

    return samples


def _read_txt(path: Path, intent: str, log: logging.Logger) -> list[IntentSample]:
    """
    Reads a plain-text file. Each non-empty line is one sample.
    Lines starting with '#' are treated as comments and skipped.
    """
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        try:
            lines = path.read_text(encoding="latin-1").splitlines()
        except Exception as exc:
            log.warning("TXT read failed '%s': %s", path.name, exc)
            raise

    rel = str(path.name)
    samples: list[IntentSample] = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#"):
            samples.append(IntentSample(text=line, intent=intent, source=rel))
    return samples


def _read_docx(path: Path, intent: str, log: logging.Logger) -> list[IntentSample]:
    """
    Reads a .docx file. Each non-empty paragraph is one sample.
    Requires python-docx (already in requirements.txt).
    """
    try:
        from docx import Document  # type: ignore[import]
    except ImportError as exc:
        log.warning("python-docx not installed — skipping '%s': %s", path.name, exc)
        raise

    try:
        doc = Document(str(path))
    except Exception as exc:
        log.warning("DOCX read failed '%s': %s", path.name, exc)
        raise

    rel = str(path.name)
    samples: list[IntentSample] = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text and not text.startswith("#"):
            samples.append(IntentSample(text=text, intent=intent, source=rel))
    return samples


# ---------------------------------------------------------------------------
# DISPATCHER
# ---------------------------------------------------------------------------

_READERS = {
    ".json": _read_json,
    ".csv":  _read_csv,
    ".txt":  _read_txt,
    ".docx": _read_docx,
}


def _read_file(
    path: Path,
    intent: str,
    log: logging.Logger,
) -> tuple[list[IntentSample], Optional[str]]:
    """
    Dispatches to the correct reader based on file extension.

    Returns:
        (samples, error_message)  — error_message is None on success.
    """
    ext = path.suffix.lower()
    reader = _READERS.get(ext)
    if reader is None:
        return [], f"Unsupported extension '{ext}'"
    try:
        samples = reader(path, intent, log)
        return samples, None
    except Exception as exc:
        return [], str(exc)


# ---------------------------------------------------------------------------
# DATASET BUILDER
# ---------------------------------------------------------------------------

class DatasetBuilder:
    """
    Scans intent_engine/datasets/, reads all supported files, and produces
    a clean, split, serialised dataset.

    Usage:
        builder = DatasetBuilder()
        result  = builder.build()
        print(result.total_clean, result.per_intent)
    """

    def __init__(self, cfg: Optional[IntentEngineConfig] = None) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def build(self) -> BuildResult:
        """
        Runs the full dataset build pipeline.

        Returns:
            BuildResult: Statistics, paths, and the DatasetSplit.
        """
        self._log.info("=" * 60)
        self._log.info("Dataset build started")
        self._log.info("Datasets dir : %s", self._cfg.datasets_dir)

        # 1. Collect raw samples
        raw_samples, failed_files = self._collect_all()
        self._log.info("Raw samples collected : %d", len(raw_samples))
        self._log.info("Failed files          : %d", len(failed_files))

        # 2. Normalise
        for s in raw_samples:
            s.text = _normalise(s.text)

        # 3. Filter by length
        raw_samples = [
            s for s in raw_samples
            if self._cfg.min_text_length <= len(s.text) <= self._cfg.max_text_length
        ]

        # 4. Deduplicate (text + intent pair)
        clean_samples = self._deduplicate(raw_samples)
        self._log.info("After dedup           : %d", len(clean_samples))

        # 5. Shuffle
        import random
        rng = random.Random(self._cfg.split_seed)
        rng.shuffle(clean_samples)

        # 6. Split
        split = self._split(clean_samples)

        # 7. Per-intent counts
        per_intent: dict[str, int] = {}
        for label in self._cfg.intent_labels:
            per_intent[label] = sum(1 for s in clean_samples if s.intent == label)
        for label, count in per_intent.items():
            if count < self._cfg.min_samples_per_intent:
                self._log.warning(
                    "Intent '%s' has only %d sample(s) — consider adding more data.",
                    label, count,
                )

        # 8. Write outputs
        json_path  = self._write_json(clean_samples)
        csv_path   = self._write_csv(clean_samples)
        stats_path = self._write_statistics(
            raw_count=len(raw_samples),
            clean_count=len(clean_samples),
            per_intent=per_intent,
            split=split,
            failed_files=failed_files,
        )

        self._log.info("intent_dataset.json   : %s", json_path)
        self._log.info("intent_dataset.csv    : %s", csv_path)
        self._log.info("dataset_statistics    : %s", stats_path)
        self._log.info("Train / Val / Test    : %d / %d / %d",
                       len(split.train), len(split.val), len(split.test))
        self._log.info("Dataset build complete")
        self._log.info("=" * 60)

        return BuildResult(
            total_raw    = len(raw_samples),
            total_clean  = len(clean_samples),
            total_train  = len(split.train),
            total_val    = len(split.val),
            total_test   = len(split.test),
            per_intent   = per_intent,
            failed_files = failed_files,
            output_json  = json_path,
            output_csv   = csv_path,
            output_stats = stats_path,
            split        = split,
        )

    # ------------------------------------------------------------------
    # COLLECTION
    # ------------------------------------------------------------------

    def _collect_all(self) -> tuple[list[IntentSample], list[str]]:
        """
        Scans every sub-folder of datasets_dir.
        Folder name → intent label (case-insensitive).
        Continues if a folder or file fails.
        """
        all_samples: list[IntentSample] = []
        failed_files: list[str] = []

        datasets_dir = self._cfg.datasets_dir
        if not datasets_dir.is_dir():
            self._log.error("Datasets directory not found: %s", datasets_dir)
            return all_samples, failed_files

        # Discover intent folders — any sub-directory counts
        intent_folders = sorted(
            p for p in datasets_dir.iterdir() if p.is_dir()
        )

        if not intent_folders:
            self._log.warning("No intent folders found in %s", datasets_dir)
            return all_samples, failed_files

        for folder in intent_folders:
            intent = folder.name.lower().strip()
            self._log.info("Scanning intent folder: %s", folder.name)

            files = sorted(
                f for f in folder.rglob("*")
                if f.is_file() and f.suffix.lower() in self._cfg.supported_extensions
            )

            if not files:
                self._log.debug("  No supported files in '%s'", folder.name)
                continue

            folder_count = 0
            for file_path in files:
                samples, error = _read_file(file_path, intent, self._log)
                if error:
                    rel = str(file_path.relative_to(self._cfg.ie_root))
                    failed_files.append(f"{rel}: {error}")
                    self._log.warning("  SKIP %s — %s", file_path.name, error)
                    continue
                folder_count += len(samples)
                all_samples.extend(samples)

            self._log.info("  %s → %d samples from %d file(s)",
                           intent, folder_count, len(files))

        return all_samples, failed_files

    # ------------------------------------------------------------------
    # DEDUPLICATION
    # ------------------------------------------------------------------

    def _deduplicate(self, samples: list[IntentSample]) -> list[IntentSample]:
        """Removes exact duplicates on (normalised_text, intent) pairs."""
        seen: set[tuple[str, str]] = set()
        unique: list[IntentSample] = []
        for s in samples:
            key = (s.text, s.intent)
            if key not in seen:
                seen.add(key)
                unique.append(s)
        removed = len(samples) - len(unique)
        if removed:
            self._log.info("Duplicates removed    : %d", removed)
        return unique

    # ------------------------------------------------------------------
    # SPLIT
    # ------------------------------------------------------------------

    def _split(self, samples: list[IntentSample]) -> DatasetSplit:
        """
        Stratified split by intent label to maintain class balance.
        Falls back to random split if a class has too few samples.
        """
        from collections import defaultdict
        import math

        by_intent: dict[str, list[IntentSample]] = defaultdict(list)
        for s in samples:
            by_intent[s.intent].append(s)

        train_list: list[IntentSample] = []
        val_list:   list[IntentSample] = []
        test_list:  list[IntentSample] = []

        for intent, group in by_intent.items():
            n = len(group)
            n_test  = max(1, math.floor(n * self._cfg.test_ratio))  if n >= 3 else 0
            n_val   = max(1, math.floor(n * self._cfg.val_ratio))   if n >= 3 else 0
            n_train = n - n_val - n_test

            if n_train < 1:
                # Too few samples — put everything in train
                train_list.extend(group)
                continue

            train_list.extend(group[:n_train])
            val_list.extend(group[n_train:n_train + n_val])
            test_list.extend(group[n_train + n_val:])

        return DatasetSplit(train=train_list, val=val_list, test=test_list)

    # ------------------------------------------------------------------
    # OUTPUT WRITERS
    # ------------------------------------------------------------------

    def _write_json(self, samples: list[IntentSample]) -> Path:
        """Writes intent_dataset.json — list of {text, intent, source} objects."""
        path = self._cfg.intent_dataset_json
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = [{"text": s.text, "intent": s.intent, "source": s.source}
                   for s in samples]
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return path

    def _write_csv(self, samples: list[IntentSample]) -> Path:
        """Writes intent_dataset.csv — columns: text, intent, source."""
        path = self._cfg.intent_dataset_csv
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["text", "intent", "source"])
            writer.writeheader()
            for s in samples:
                writer.writerow({"text": s.text, "intent": s.intent, "source": s.source})
        return path

    def _write_statistics(
        self,
        raw_count:    int,
        clean_count:  int,
        per_intent:   dict[str, int],
        split:        DatasetSplit,
        failed_files: list[str],
    ) -> Path:
        """Writes dataset_statistics.json."""
        path = self._cfg.dataset_statistics_json
        path.parent.mkdir(parents=True, exist_ok=True)

        # Per-intent split breakdown
        from collections import Counter
        train_counts = Counter(s.intent for s in split.train)
        val_counts   = Counter(s.intent for s in split.val)
        test_counts  = Counter(s.intent for s in split.test)

        intent_breakdown = {
            label: {
                "total": per_intent.get(label, 0),
                "train": train_counts.get(label, 0),
                "val":   val_counts.get(label, 0),
                "test":  test_counts.get(label, 0),
            }
            for label in self._cfg.intent_labels
        }

        payload = {
            "generated_at":  datetime.now(timezone.utc).isoformat(),
            "total_raw":     raw_count,
            "total_clean":   clean_count,
            "duplicates_removed": raw_count - clean_count,
            "total_train":   len(split.train),
            "total_val":     len(split.val),
            "total_test":    len(split.test),
            "num_intents":   len([k for k, v in per_intent.items() if v > 0]),
            "intent_labels": list(self._cfg.intent_labels),
            "per_intent":    intent_breakdown,
            "failed_files":  failed_files,
            "split_ratios": {
                "train": self._cfg.train_ratio,
                "val":   self._cfg.val_ratio,
                "test":  self._cfg.test_ratio,
            },
        }
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return path


# ---------------------------------------------------------------------------
# MODULE-LEVEL CONVENIENCE
# ---------------------------------------------------------------------------

def build_dataset(cfg: Optional[IntentEngineConfig] = None) -> BuildResult:
    """
    One-call entry point for dataset building.

    Usage:
        from intent_engine.dataset_builder import build_dataset
        result = build_dataset()
        print(result.total_clean, result.per_intent)
    """
    return DatasetBuilder(cfg=cfg).build()


# ---------------------------------------------------------------------------
# SELF-TEST
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    result = build_dataset()
    print("\n" + "=" * 60)
    print("  AKP Intent Engine — Dataset Build Summary")
    print("=" * 60)
    print(f"\n  Raw samples    : {result.total_raw}")
    print(f"  Clean samples  : {result.total_clean}")
    print(f"  Train          : {result.total_train}")
    print(f"  Val            : {result.total_val}")
    print(f"  Test           : {result.total_test}")
    print(f"\n  Per-intent breakdown:")
    for intent, count in sorted(result.per_intent.items()):
        print(f"    {intent:<15} : {count}")
    if result.failed_files:
        print(f"\n  Failed files ({len(result.failed_files)}):")
        for f in result.failed_files:
            print(f"    {f}")
    print(f"\n  Outputs:")
    print(f"    JSON  : {result.output_json}")
    print(f"    CSV   : {result.output_csv}")
    print(f"    Stats : {result.output_stats}")
    print("\n" + "=" * 60 + "\n")
