from __future__ import annotations

from functools import lru_cache
from typing import Sequence

import numpy as np
from sentence_transformers import SentenceTransformer

from rag.config import BATCH_SIZE, DEVICE, EMBEDDING_MODEL, EMBEDDING_REVISION


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    return SentenceTransformer(
        EMBEDDING_MODEL,
        revision=EMBEDDING_REVISION,
        device=DEVICE,
    )


def embed_passages(texts: Sequence[str]) -> np.ndarray:
    model = get_model()
    model.max_seq_length = 512
    inputs = [f"passage: {text}" for text in texts]
    vectors = model.encode(
        inputs,
        batch_size=BATCH_SIZE,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    return np.asarray(vectors, dtype=np.float32)


def embed_query(text: str) -> np.ndarray:
    model = get_model()
    model.max_seq_length = 512
    vector = model.encode(
        [f"query: {text}"],
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )[0]
    return np.asarray(vector, dtype=np.float32)


def tokenizer():
    return get_model().tokenizer
