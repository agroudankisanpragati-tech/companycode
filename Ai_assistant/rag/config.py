from __future__ import annotations

import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE_ROOT = REPO_ROOT / "knowledge"
RAG_ROOT = Path(__file__).resolve().parents[1]
CHROMA_PATH = Path(os.getenv("AKP_CHROMA_PATH", RAG_ROOT / "data" / "chroma")).resolve()
MANIFEST_DIR = RAG_ROOT / "manifests"

EMBEDDING_MODEL = os.getenv("AKP_EMBEDDING_MODEL", "intfloat/multilingual-e5-small")
EMBEDDING_REVISION = os.getenv("AKP_EMBEDDING_REVISION", "main")
DEVICE = os.getenv("AKP_EMBEDDING_DEVICE", "cpu")
BATCH_SIZE = int(os.getenv("AKP_EMBEDDING_BATCH_SIZE", "8"))

COLLECTIONS = {
    "website": "akp_website_draft_v1",
    "agriculture": "akp_agriculture_draft_v1",
}

CHUNK_TARGET_TOKENS = int(os.getenv("AKP_CHUNK_TARGET_TOKENS", "430"))
CHUNK_MAX_TOKENS = int(os.getenv("AKP_CHUNK_MAX_TOKENS", "480"))
CHUNK_OVERLAP_TOKENS = int(os.getenv("AKP_CHUNK_OVERLAP_TOKENS", "50"))
CHUNKER_VERSION = "heading-blocks-v1"

STATUS_MAP = {
    "draft-source-backed": "draft",
    "draft-verified-from-repository": "draft",
    "reviewed": "reviewed",
    "needs-update": "needs-update",
    "retired": "retired",
}

EXCLUDED_RELATIVE_PATHS = {
    Path("website") / "assistant-page-context.md",
}
