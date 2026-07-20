# =============================================================================
# Pragati AI — Voice Dataset Generator
# sentence_splitter.py
# Splits cleaned paragraphs into individual sentences.
# Handles Hindi/Devanagari sentence endings (।) and standard punctuation.
# =============================================================================

import re
from typing import List

from voice_generator.text_cleaner import clean_text, is_heading

# Splits on Devanagari danda (।), double danda (॥), or . ! ? followed by whitespace
_SENTENCE_BOUNDARY = re.compile(r"(?<=[।॥.!?])\s+")


def split_into_sentences(paragraph: str) -> List[str]:
    parts = _SENTENCE_BOUNDARY.split(paragraph)
    return [p.strip() for p in parts if p.strip()]


def extract_sentences(
    raw_paragraphs: List[str],
    min_length: int = 5,
    max_length: int = 300,
) -> List[str]:
    """
    Full pipeline for raw paragraphs from one DOCX file:
    1. Skip empty lines
    2. Skip headings
    3. Clean each paragraph
    4. Split into sentences
    5. Filter by min/max length
    Deduplication is handled at language level in batch_processor.py.
    """
    sentences: List[str] = []

    for raw in raw_paragraphs:
        if not raw or not raw.strip():
            continue

        cleaned = clean_text(raw)
        if not cleaned:
            continue

        if is_heading(cleaned):
            continue

        for sentence in split_into_sentences(cleaned):
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) < min_length:
                continue
            if len(sentence) > max_length:
                continue
            sentences.append(sentence)

    return sentences
