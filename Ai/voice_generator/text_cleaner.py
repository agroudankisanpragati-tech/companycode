# =============================================================================
# Pragati AI — Voice Dataset Generator
# text_cleaner.py
# Cleans raw paragraph text: removes bullets, numbering, extra whitespace.
# =============================================================================

import re

# Bullet characters commonly found in DOCX files
_BULLET_CHARS = r"[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u2714\u2713\-\*\•]"

# Matches leading numbering: "1.", "1)", "(1)", "a.", "a)", "i.", etc.
_NUMBERING_PATTERN = re.compile(
    r"^\s*(?:\(?\s*(?:[0-9]+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)\s*[\.\)]\s*)+"
)

# Matches leading bullet characters
_BULLET_PATTERN = re.compile(rf"^\s*{_BULLET_CHARS}+\s*")

# Collapses multiple whitespace/newline characters into a single space
_WHITESPACE_PATTERN = re.compile(r"\s+")


def clean_text(text: str) -> str:
    text = text.strip()
    text = _BULLET_PATTERN.sub("", text)
    text = _NUMBERING_PATTERN.sub("", text)
    text = _WHITESPACE_PATTERN.sub(" ", text)
    return text.strip()


def is_heading(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    if stripped.isupper() and len(stripped) < 80:
        return True
    if stripped.endswith(":") and len(stripped) < 60:
        return True
    if stripped.isdigit():
        return True
    return False
