# =============================================================================
# Pragati AI — Voice Dataset Generator
# generator.py
# Main entry point. Auto-detects all paths from project root.
# Validates Piper executable, voice models, and input folders before starting.
#
# Usage (run from Ai/ directory):
#   python -m voice_generator.generator
#   python -m voice_generator.generator --config configs/voice_generator_config.yaml
# =============================================================================

import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List

import yaml

from voice_generator.batch_processor import LanguageBatchProcessor, LanguageStats


# ── Paths ─────────────────────────────────────────────────────────────────────

# Ai/ root is the parent of this package's directory
AI_ROOT: Path = Path(__file__).resolve().parent.parent


# ── Logging ───────────────────────────────────────────────────────────────────

def setup_logging(logs_folder: Path) -> Path:
    logs_folder.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = logs_folder / f"voice_gen_{timestamp}.log"

    fmt = "%(asctime)s | %(levelname)-8s | %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    root = logging.getLogger("voice_generator")
    root.setLevel(logging.DEBUG)
    root.handlers.clear()

    fh = logging.FileHandler(str(log_file), encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter(fmt, datefmt=datefmt))
    root.addHandler(fh)

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter(fmt, datefmt=datefmt))
    root.addHandler(ch)

    return log_file


# ── Config ────────────────────────────────────────────────────────────────────

def load_config(config_path: Path) -> dict:
    if not config_path.is_file():
        raise FileNotFoundError(f"Config not found: {config_path}")
    with config_path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def resolve_path(base: Path, value: str) -> Path:
    p = Path(value)
    if p.is_absolute():
        return p
    return (base / p).resolve()


# ── Validation ────────────────────────────────────────────────────────────────

def validate_setup(
    piper_dir: Path,
    voices_dir: Path,
    voice_models: dict,
    input_root: Path,
    languages: List[str],
    logger: logging.Logger,
) -> bool:
    ok = True

    piper_exe = piper_dir / "piper.exe"
    if not piper_exe.is_file():
        logger.error(f"MISSING piper.exe: {piper_exe}")
        ok = False
    else:
        logger.info(f"Piper executable : {piper_exe}")

    espeak_data = piper_dir / "espeak-ng-data"
    if not espeak_data.is_dir():
        logger.warning(f"espeak-ng-data not found at: {espeak_data} (may cause TTS errors)")

    for lang in languages:
        model_rel = voice_models.get(lang)
        if not model_rel:
            logger.error(f"No voice model configured for language: {lang}")
            ok = False
            continue

        onnx = voices_dir / model_rel
        json = Path(str(onnx) + ".json")

        if not onnx.is_file():
            logger.error(f"[{lang}] Voice model missing: {onnx}")
            ok = False
        else:
            logger.info(f"[{lang}] Voice model : {onnx.name}")

        if not json.is_file():
            logger.error(f"[{lang}] Model config missing: {json}")
            ok = False

        lang_input = input_root / lang
        if not lang_input.is_dir():
            logger.warning(f"[{lang}] Input folder missing: {lang_input} (will skip)")

    return ok


# ── Summary ───────────────────────────────────────────────────────────────────

def print_summary(all_stats: List[LanguageStats], total_time: float) -> None:
    logger = logging.getLogger("voice_generator")
    sep = "=" * 70

    logger.info(sep)
    logger.info("VOICE DATASET GENERATION — FINAL SUMMARY")
    logger.info(sep)

    total_files = total_sentences = total_dupes = 0
    total_generated = total_failed = total_skipped = 0

    for s in all_stats:
        failed_label = f" {s.failed_files}" if s.failed_files else ""
        logger.info(
            f"  Language        : {s.language.upper()}\n"
            f"  Processed Files : {s.processed_files}\n"
            f"  Failed Files    : {len(s.failed_files)}{failed_label}\n"
            f"  Total Sentences : {s.total_sentences}\n"
            f"  Duplicates      : {s.duplicate_sentences}\n"
            f"  Generated Audio : {s.generated_audio}\n"
            f"  Failed Audio    : {s.failed_audio}\n"
            f"  Already Existed : {s.skipped_existing}\n"
            f"  Time            : {s.processing_time:.1f}s\n"
        )
        total_files += s.processed_files
        total_sentences += s.total_sentences
        total_dupes += s.duplicate_sentences
        total_generated += s.generated_audio
        total_failed += s.failed_audio
        total_skipped += s.skipped_existing

    logger.info(sep)
    logger.info(f"  TOTAL FILES PROCESSED : {total_files}")
    logger.info(f"  TOTAL SENTENCES       : {total_sentences}")
    logger.info(f"  TOTAL DUPLICATES      : {total_dupes}")
    logger.info(f"  TOTAL AUDIO GENERATED : {total_generated}")
    logger.info(f"  TOTAL AUDIO FAILED    : {total_failed}")
    logger.info(f"  TOTAL ALREADY EXISTED : {total_skipped}")
    logger.info(f"  TOTAL TIME            : {total_time:.1f}s")
    logger.info(sep)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pragati AI — Voice Dataset Generator"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="configs/voice_generator_config.yaml",
        help="Path to config YAML (relative to Ai/ root or absolute)",
    )
    args = parser.parse_args()

    config_path = resolve_path(AI_ROOT, args.config)
    config = load_config(config_path)

    paths_cfg = config["paths"]
    input_root = resolve_path(AI_ROOT, paths_cfg["input_folder"])
    output_root = resolve_path(AI_ROOT, paths_cfg["output_folder"])
    logs_folder = resolve_path(AI_ROOT, paths_cfg["logs_folder"])
    piper_dir = resolve_path(AI_ROOT, paths_cfg["piper_dir"])
    voices_dir = resolve_path(AI_ROOT, paths_cfg["voices_dir"])

    voice_models: dict = config.get("voice_models", {})
    languages: List[str] = config["languages"]
    sample_rate: int = config["audio"]["sample_rate"]
    min_length: int = config["sentence"]["min_length"]
    max_length: int = config["sentence"]["max_length"]
    num_workers: int = config["processing"]["num_workers"]
    resume_mode: bool = config["processing"]["resume_mode"]

    log_file = setup_logging(logs_folder)
    logger = logging.getLogger("voice_generator")

    logger.info("=" * 70)
    logger.info("Pragati AI — Voice Dataset Generator")
    logger.info(f"AI Root    : {AI_ROOT}")
    logger.info(f"Config     : {config_path}")
    logger.info(f"Log file   : {log_file}")
    logger.info(f"Input      : {input_root}")
    logger.info(f"Output     : {output_root}")
    logger.info(f"Piper dir  : {piper_dir}")
    logger.info(f"Voices dir : {voices_dir}")
    logger.info(f"Languages  : {languages}")
    logger.info(f"Workers    : {num_workers}")
    logger.info(f"Resume     : {resume_mode}")
    logger.info("=" * 70)

    # Validate all required files exist before starting any language
    if not validate_setup(piper_dir, voices_dir, voice_models, input_root, languages, logger):
        logger.error("Validation failed. Fix the above errors and re-run.")
        sys.exit(1)

    output_root.mkdir(parents=True, exist_ok=True)

    overall_start = time.time()
    all_stats: List[LanguageStats] = []

    for language in languages:
        model_relative = voice_models.get(language, "")
        if not model_relative:
            logger.error(f"[{language}] No voice model mapping found. Skipping.")
            all_stats.append(LanguageStats(language=language))
            continue

        try:
            processor = LanguageBatchProcessor(
                language=language,
                input_root=input_root,
                output_root=output_root,
                piper_dir=piper_dir,
                voices_dir=voices_dir,
                model_relative=model_relative,
                sample_rate=sample_rate,
                min_sentence_length=min_length,
                max_sentence_length=max_length,
                num_workers=num_workers,
                resume_mode=resume_mode,
            )
            stats = processor.process()
        except Exception as exc:
            logger.error(f"[{language}] Unexpected error — skipping language: {exc}")
            stats = LanguageStats(language=language)

        all_stats.append(stats)

    total_time = time.time() - overall_start
    print_summary(all_stats, total_time)


if __name__ == "__main__":
    main()
