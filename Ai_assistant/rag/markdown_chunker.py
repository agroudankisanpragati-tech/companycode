from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any

from rag.config import CHUNK_MAX_TOKENS, CHUNK_OVERLAP_TOKENS, CHUNK_TARGET_TOKENS, CHUNKER_VERSION
from rag.source_loader import SourceDocument


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    text: str
    metadata: dict[str, Any]
    token_count: int


def _count_tokens(text: str, tokenizer: Any) -> int:
    if tokenizer is None:
        return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))
    encoded = tokenizer(text, add_special_tokens=False, truncation=False)
    return len(encoded["input_ids"])


def _is_ordered_list(block: str) -> bool:
    return bool(re.match(r"^\s*\d+[.)]\s", block))


def _title_and_blocks(content: str) -> tuple[str, list[tuple[str, str]]]:
    title = ""
    heading_path: list[str] = []
    blocks: list[tuple[str, str]] = []
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_lines
        block = "\n".join(current_lines).strip()
        if block:
            blocks.append((" > ".join(heading_path), block))
        current_lines = []

    for line in content.splitlines():
        heading = re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if heading:
            flush()
            level = len(heading.group(1))
            label = heading.group(2).strip()
            if level == 1 and not title:
                title = label
            heading_path = heading_path[:level - 1]
            heading_path.append(label)
            continue
        if not line.strip():
            flush()
            continue
        # Keep consecutive list items (especially numbered procedures) together.
        if current_lines:
            previous_is_list = bool(re.match(r"^\s*(?:[-*+]\s|\d+[.)]\s)", current_lines[-1]))
            line_is_list = bool(re.match(r"^\s*(?:[-*+]\s|\d+[.)]\s)", line))
            if (previous_is_list or line_is_list) and (previous_is_list or line_is_list):
                current_lines.append(line)
                continue
            flush()
        current_lines.append(line)
    flush()
    return title or "Knowledge article", blocks


def chunk_document(document: SourceDocument, tokenizer: Any = None) -> list[Chunk]:
    title, blocks = _title_and_blocks(document.content)
    units: list[tuple[str, str, int]] = []
    pending_path = ""
    pending: list[str] = []

    def flush_pending() -> None:
        nonlocal pending, pending_path
        if pending:
            body = "\n\n".join(pending)
            units.append((pending_path, body, _count_tokens(body, tokenizer)))
        pending = []
        pending_path = ""

    for path, block in blocks:
        prefix = f"{title}\n{path}\n" if path else f"{title}\n"
        if pending and path != pending_path:
            flush_pending()
        candidate = "\n\n".join([*pending, block])
        candidate_count = _count_tokens(prefix + candidate, tokenizer)
        if pending and candidate_count > CHUNK_TARGET_TOKENS:
            overlap = pending[-1] if pending and not _is_ordered_list(pending[-1]) else None
            overlap_path = pending_path
            flush_pending()
            if overlap and _count_tokens(prefix + overlap, tokenizer) <= CHUNK_OVERLAP_TOKENS:
                pending_path = overlap_path
                pending.append(overlap)
        if not pending:
            pending_path = path
        pending.append(block)
        if _count_tokens(prefix + "\n\n".join(pending), tokenizer) > CHUNK_MAX_TOKENS:
            # Keep a single ordered list intact even if it slightly exceeds the target.
            flush_pending()
    flush_pending()

    result: list[Chunk] = []
    for index, (section_path, body, _) in enumerate(units):
        text = f"Title: {title}\nSection: {section_path or 'Overview'}\n\n{body}".strip()
        count = _count_tokens(text, tokenizer)
        if count > 500:
            raise ValueError(
                f"Chunk exceeds the safe model input size ({count} tokens) in "
                f"{document.document_id}, section {section_path!r}; split the source section manually."
            )
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        chunk_id = f"{document.document_id}:{index:04d}:{digest}"
        source_meta = document.front_matter
        metadata: dict[str, Any] = {
            "domain": document.domain,
            "document_id": document.document_id,
            "document_version": hashlib.sha256(document.content.encode("utf-8")).hexdigest()[:16],
            "title": title,
            "section_path": section_path or "Overview",
            "topic": str(source_meta.get("topic", "general")),
            "geography": str(source_meta.get("geography", "unspecified")),
            "crop": str(source_meta.get("crop", "unspecified")),
            "growth_stage": str(source_meta.get("growth_stage", "not-specified")),
            "source_url": str(source_meta.get("source", source_meta.get("source_path", document.relative_path))),
            "publisher": str(source_meta.get("publisher", "project repository")),
            "source_published": str(source_meta.get("published", "unknown")),
            "date_checked": str(source_meta.get("date_checked", "unknown")),
            "review_status": document.review_status,
            "source_status": document.status,
            "source_path": document.relative_path,
            "chunk_index": index,
            "chunk_token_count": count,
            "chunker_version": CHUNKER_VERSION,
            "content_hash": digest,
        }
        result.append(Chunk(chunk_id=chunk_id, text=text, metadata=metadata, token_count=count))

    return result
