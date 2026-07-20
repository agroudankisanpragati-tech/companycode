# =============================================================================
# Pragati AI — Voice Dataset Generator
# metadata_writer.py
# Manages metadata.csv for each language voice dataset.
# Format per line: 000001.wav|Sentence Text
# Uses pathlib for all file operations.
# =============================================================================

import csv
import logging
from pathlib import Path
from typing import List, Set, Tuple

logger = logging.getLogger("voice_generator")


class MetadataWriter:
    """
    Handles reading and writing of metadata.csv for a single language.
    Supports resume mode by loading already-written entries on init.
    """

    def __init__(self, metadata_path: Path):
        self.metadata_path = metadata_path
        self._existing_files: Set[str] = set()
        self._load_existing()

    def _load_existing(self) -> None:
        if self.metadata_path.is_file():
            try:
                with self.metadata_path.open("r", encoding="utf-8") as f:
                    reader = csv.reader(f, delimiter="|")
                    for row in reader:
                        if row and row[0].strip():
                            self._existing_files.add(row[0].strip())
                logger.debug(
                    f"Loaded {len(self._existing_files)} existing entries "
                    f"from {self.metadata_path.name}"
                )
            except Exception as exc:
                logger.warning(f"Could not read existing metadata: {exc}")

    def is_already_written(self, wav_filename: str) -> bool:
        return wav_filename in self._existing_files

    def append_entry(self, wav_filename: str, sentence: str) -> None:
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        with self.metadata_path.open("a", encoding="utf-8", newline="") as f:
            writer = csv.writer(
                f, delimiter="|", quoting=csv.QUOTE_NONE, escapechar="\\"
            )
            writer.writerow([wav_filename, sentence])
        self._existing_files.add(wav_filename)

    def write_all(self, entries: List[Tuple[str, str]]) -> None:
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        with self.metadata_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.writer(
                f, delimiter="|", quoting=csv.QUOTE_NONE, escapechar="\\"
            )
            for wav_filename, sentence in entries:
                writer.writerow([wav_filename, sentence])
        self._existing_files = {e[0] for e in entries}

    @property
    def written_count(self) -> int:
        return len(self._existing_files)
