# =============================================================================
# Pragati AI — Voice Dataset Generator
# batch_processor.py
# Processes one language folder end-to-end:
#   DOCX → sentences → deduplicate → generate WAV → write metadata.csv
# Uses pathlib everywhere. Supports multiprocessing and resume mode.
# Never stops on a single failure.
# =============================================================================

import logging
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple

from voice_generator.docx_reader import read_all_docx_in_folder
from voice_generator.sentence_splitter import extract_sentences
from voice_generator.metadata_writer import MetadataWriter
from voice_generator.voice_generator import PiperTTSEngine

logger = logging.getLogger("voice_generator")


@dataclass
class LanguageStats:
    language: str
    processed_files: int = 0
    failed_files: List[str] = field(default_factory=list)
    total_sentences: int = 0
    duplicate_sentences: int = 0
    generated_audio: int = 0
    failed_audio: int = 0
    skipped_existing: int = 0
    processing_time: float = 0.0


def _synthesize_one(args: Tuple) -> Tuple[str, str, bool]:
    """
    Top-level picklable function required for ProcessPoolExecutor.
    Returns (wav_filename, sentence, success).
    """
    (
        wav_filename,
        sentence,
        output_wav_str,
        piper_dir_str,
        voices_dir_str,
        model_relative,
        sample_rate,
    ) = args

    piper_dir = Path(piper_dir_str)
    voices_dir = Path(voices_dir_str)
    output_wav_path = Path(output_wav_str)

    try:
        engine = PiperTTSEngine(piper_dir, voices_dir, model_relative, sample_rate)
        success = engine.synthesize(sentence, output_wav_path)
    except Exception:
        success = False

    return wav_filename, sentence, success


class LanguageBatchProcessor:
    """
    Processes all DOCX files for a single language and generates the
    complete voice dataset (WAV files + metadata.csv).
    """

    def __init__(
        self,
        language: str,
        input_root: Path,
        output_root: Path,
        piper_dir: Path,
        voices_dir: Path,
        model_relative: str,
        sample_rate: int,
        min_sentence_length: int,
        max_sentence_length: int,
        num_workers: int,
        resume_mode: bool,
    ):
        self.language = language
        self.lang_input_path: Path = input_root / language
        self.audio_dir: Path = output_root / language / "audio"
        self.metadata_path: Path = output_root / language / "metadata.csv"
        self.piper_dir = piper_dir
        self.voices_dir = voices_dir
        self.model_relative = model_relative
        self.sample_rate = sample_rate
        self.min_sentence_length = min_sentence_length
        self.max_sentence_length = max_sentence_length
        self.num_workers = num_workers
        self.resume_mode = resume_mode

        self.audio_dir.mkdir(parents=True, exist_ok=True)

    def _collect_sentences(self, stats: LanguageStats) -> List[str]:
        if not self.lang_input_path.is_dir():
            logger.warning(
                f"[{self.language}] Input folder not found: {self.lang_input_path}"
            )
            return []

        all_sentences: List[str] = []
        seen: set = set()

        try:
            docx_entries = read_all_docx_in_folder(self.lang_input_path)
        except Exception as exc:
            logger.error(f"[{self.language}] Cannot scan input folder: {exc}")
            return []

        for filename, paragraphs in docx_entries:
            try:
                sentences = extract_sentences(
                    paragraphs,
                    min_length=self.min_sentence_length,
                    max_length=self.max_sentence_length,
                )
                stats.processed_files += 1
                stats.total_sentences += len(sentences)

                for sentence in sentences:
                    if sentence in seen:
                        stats.duplicate_sentences += 1
                        continue
                    seen.add(sentence)
                    all_sentences.append(sentence)

                logger.debug(
                    f"[{self.language}] {filename}: "
                    f"{len(sentences)} sentences extracted"
                )
            except Exception as exc:
                stats.failed_files.append(filename)
                logger.error(
                    f"[{self.language}] Failed to process {filename}: {exc}"
                )
                continue

        return all_sentences

    def process(self) -> LanguageStats:
        stats = LanguageStats(language=self.language)
        start_time = time.time()

        logger.info(f"[{self.language.upper()}] ── Starting ──────────────────────────")

        sentences = self._collect_sentences(stats)

        if not sentences:
            logger.warning(f"[{self.language}] No sentences found. Skipping language.")
            stats.processing_time = time.time() - start_time
            return stats

        unique_count = len(sentences)
        logger.info(
            f"[{self.language}] Files: {stats.processed_files} | "
            f"Raw sentences: {stats.total_sentences} | "
            f"Duplicates removed: {stats.duplicate_sentences} | "
            f"Unique: {unique_count}"
        )

        metadata_writer = MetadataWriter(self.metadata_path)

        work_queue: List[Tuple] = []
        for idx, sentence in enumerate(sentences, start=1):
            wav_filename = f"{idx:06d}.wav"
            output_wav_path = self.audio_dir / wav_filename

            if self.resume_mode and metadata_writer.is_already_written(wav_filename):
                if output_wav_path.is_file() and output_wav_path.stat().st_size > 0:
                    stats.skipped_existing += 1
                    continue

            work_queue.append((
                wav_filename,
                sentence,
                str(output_wav_path),
                str(self.piper_dir),
                str(self.voices_dir),
                self.model_relative,
                self.sample_rate,
            ))

        logger.info(
            f"[{self.language}] Already generated: {stats.skipped_existing} | "
            f"To generate: {len(work_queue)}"
        )

        if not work_queue:
            logger.info(f"[{self.language}] Nothing to generate. All done.")
            stats.processing_time = time.time() - start_time
            return stats

        total = len(work_queue)
        completed = 0
        batch_start = time.time()

        with ProcessPoolExecutor(max_workers=self.num_workers) as executor:
            futures = {
                executor.submit(_synthesize_one, args): args
                for args in work_queue
            }

            for future in as_completed(futures):
                completed += 1
                try:
                    wav_filename, sentence, success = future.result()
                    if success:
                        stats.generated_audio += 1
                        metadata_writer.append_entry(wav_filename, sentence)
                    else:
                        stats.failed_audio += 1
                        logger.warning(
                            f"[{self.language}] Audio failed: {wav_filename}"
                        )
                except Exception as exc:
                    stats.failed_audio += 1
                    logger.error(f"[{self.language}] Worker error: {exc}")

                # Progress log every 50 completions
                if completed % 50 == 0 or completed == total:
                    elapsed = time.time() - batch_start
                    rate = completed / elapsed if elapsed > 0 else 0
                    remaining = total - completed
                    eta = remaining / rate if rate > 0 else 0
                    logger.info(
                        f"[{self.language}] Progress: {completed}/{total} | "
                        f"Generated: {stats.generated_audio} | "
                        f"Failed: {stats.failed_audio} | "
                        f"ETA: {eta:.0f}s"
                    )

        stats.processing_time = time.time() - start_time
        logger.info(
            f"[{self.language.upper()}] ── Complete ───────────────────────────\n"
            f"  Generated : {stats.generated_audio}\n"
            f"  Failed    : {stats.failed_audio}\n"
            f"  Skipped   : {stats.skipped_existing}\n"
            f"  Time      : {stats.processing_time:.1f}s"
        )
        return stats
