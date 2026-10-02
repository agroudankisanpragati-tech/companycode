from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from rag.config import EXCLUDED_RELATIVE_PATHS, KNOWLEDGE_ROOT, STATUS_MAP


@dataclass(frozen=True)
class SourceDocument:
    path: Path
    relative_path: str
    domain: str
    document_id: str
    title: str
    status: str
    review_status: str
    content: str
    front_matter: dict[str, Any]


def _split_front_matter(raw: str, path: Path) -> tuple[dict[str, Any], str]:
    if not raw.startswith("---\n") and not raw.startswith("---\r\n"):
        raise ValueError(f"Missing YAML front matter: {path}")
    lines = raw.splitlines()
    try:
        closing = lines.index("---", 1)
    except ValueError as exc:
        raise ValueError(f"Unclosed YAML front matter: {path}") from exc
    metadata = yaml.safe_load("\n".join(lines[1:closing])) or {}
    if not isinstance(metadata, dict):
        raise ValueError(f"Front matter must be a mapping: {path}")
    return metadata, "\n".join(lines[closing + 1:]).strip()


def _domain_for(path: Path) -> str:
    relative = path.relative_to(KNOWLEDGE_ROOT)
    if relative.parts[0] not in {"website", "agriculture"}:
        raise ValueError(f"Unsupported knowledge domain: {relative}")
    return relative.parts[0]


def _is_excluded(path: Path) -> bool:
    relative = path.relative_to(KNOWLEDGE_ROOT)
    if relative in EXCLUDED_RELATIVE_PATHS:
        return True
    if path.name.lower() == "readme.md":
        return True
    if "evaluation" in relative.parts:
        return True
    if relative.parts[0] == "agriculture" and path.name in {
        "source-audit.md", "metadata-and-review.md", "safety-and-scope.md", "sources.md"
    }:
        return True
    return False


def load_sources() -> tuple[list[SourceDocument], list[dict[str, str]]]:
    documents: list[SourceDocument] = []
    excluded: list[dict[str, str]] = []

    for path in sorted(KNOWLEDGE_ROOT.rglob("*.md")):
        if _is_excluded(path):
            excluded.append({"path": path.relative_to(KNOWLEDGE_ROOT).as_posix(), "reason": "excluded by corpus policy"})
            continue
        try:
            raw = path.read_text(encoding="utf-8")
            metadata, content = _split_front_matter(raw, path)
            domain = _domain_for(path)
            status = str(metadata.get("status", ""))
            normalized_status = STATUS_MAP.get(status)
            if normalized_status not in {"draft", "reviewed"}:
                excluded.append({"path": path.relative_to(KNOWLEDGE_ROOT).as_posix(), "reason": f"status is not indexable: {status or 'missing'}"})
                continue
            document_id = str(metadata.get("id", "")).strip()
            title_line = next((line.strip("# ") for line in content.splitlines() if line.startswith("# ")), path.stem.replace("-", " ").title())
            if not document_id or not content:
                raise ValueError(f"Missing id or article content: {path}")
            declared_domain = str(metadata.get("domain", "")).strip()
            if declared_domain != domain:
                raise ValueError(f"Front-matter domain {declared_domain!r} does not match {domain!r}: {path}")
            documents.append(SourceDocument(
                path=path,
                relative_path=path.relative_to(KNOWLEDGE_ROOT).as_posix(),
                domain=domain,
                document_id=document_id,
                title=title_line,
                status=status,
                review_status=normalized_status,
                content=content,
                front_matter=metadata,
            ))
        except Exception as exc:
            excluded.append({"path": path.relative_to(KNOWLEDGE_ROOT).as_posix(), "reason": f"metadata/content validation failed: {exc}"})

    seen: set[tuple[str, str]] = set()
    for doc in documents:
        key = (doc.domain, doc.document_id)
        if key in seen:
            raise ValueError(f"Duplicate document id in domain {doc.domain}: {doc.document_id}")
        seen.add(key)
    return documents, excluded
