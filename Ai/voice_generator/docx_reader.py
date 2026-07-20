# =============================================================================
# Pragati AI — Voice Dataset Generator
# docx_reader.py
# Reads every DOCX file in a language folder and extracts raw paragraph text.
# Uses pathlib for all file operations.
# =============================================================================

import logging
from pathlib import Path
from typing import List, Tuple

from docx import Document

logger = logging.getLogger("voice_generator")


def read_docx(file_path: Path) -> List[str]:
    """
    Open a single DOCX file and return a list of raw paragraph strings.
    Raises exception to caller — never silently swallows errors.
    """
    doc = Document(str(file_path))
    paragraphs: List[str] = []
    for para in doc.paragraphs:
        text = para.text
        if text and text.strip():
            paragraphs.append(text.strip())
    return paragraphs


def read_all_docx_in_folder(folder_path: Path) -> List[Tuple[str, List[str]]]:
    """
    Scan a language folder for all .docx files sorted by filename.
    Returns list of (filename, [paragraphs]) tuples.
    Files that fail to open are skipped and logged — batch continues.
    """
    if not folder_path.is_dir():
        raise NotADirectoryError(f"Language folder not found: {folder_path}")

    docx_files = sorted(folder_path.glob("*.docx"))

    if not docx_files:
        logger.warning(f"No .docx files found in: {folder_path}")
        return []

    results: List[Tuple[str, List[str]]] = []
    for docx_path in docx_files:
        try:
            paragraphs = read_docx(docx_path)
            results.append((docx_path.name, paragraphs))
            logger.debug(f"Read {len(paragraphs)} paragraphs from: {docx_path.name}")
        except Exception as exc:
            logger.error(f"Failed to read {docx_path.name}: {exc}")
            continue

    return results
