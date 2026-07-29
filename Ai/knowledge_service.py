# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_service.py
# Purpose: Given a prediction result (crop, category, class_name), query
#          MongoDB and return the full agronomic knowledge record managed
#          by the Admin Panel.
# =============================================================================

from __future__ import annotations

import os
import re
import atexit
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

# Load .env — prefer Ai/.env, fall back to backend/.env
try:
    from dotenv import load_dotenv
    _ai_env = Path(__file__).parent / ".env"
    if _ai_env.exists():
        load_dotenv(_ai_env, override=False)
    else:
        _backend_env = Path(__file__).parent.parent / "backend" / ".env"
        if _backend_env.exists():
            load_dotenv(_backend_env, override=False)
except ImportError:
    pass

from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — CONNECTION CONFIGURATION
# =============================================================================

@dataclass(frozen=True)
class MongoDBConfig:
    """
    All MongoDB connection parameters in one place.
    All values are read from environment variables with safe defaults.
    """
    uri:        str = field(default_factory=lambda: os.getenv("MONGO_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017")))
    db_name:    str = field(default_factory=lambda: os.getenv("MONGO_DB_NAME", "kisan-pragati"))
    collection: str = field(default_factory=lambda: os.getenv("MONGO_COLLECTION", "diseasepestsolutions"))
    timeout_ms: int = field(default_factory=lambda: int(os.getenv("MONGO_TIMEOUT_MS", "5000")))


# =============================================================================
# SECTION 2 — KNOWLEDGE RESULT CONTRACT
# =============================================================================

@dataclass
class KnowledgeResult:
    """
    The complete agronomic knowledge record returned for a prediction.
    All fields come exclusively from MongoDB.
    """
    found:               bool
    crop:                str
    category:            str
    class_name:          str
    description:         str                = ""
    symptoms:            str                = ""
    causes:              str                = ""
    organic_solution:    str                = ""
    chemical_solution:   str                = ""
    prevention:          str                = ""
    severity:            str                = ""
    affected_part:       str                = ""
    scientific_name:     str                = ""
    recommended_products: str               = ""
    images:              list[str]          = field(default_factory=list)
    videos:              list[str]          = field(default_factory=list)
    references:          list[str]          = field(default_factory=list)
    language:            str                = "en"
    error:               Optional[str]      = None
    raw:                 Optional[dict]     = None

    def to_dict(self) -> dict:
        return {
            "found":               self.found,
            "crop":                self.crop,
            "category":            self.category,
            "class_name":          self.class_name,
            "description":         self.description,
            "symptoms":            self.symptoms,
            "causes":              self.causes,
            "organic_solution":    self.organic_solution,
            "chemical_solution":   self.chemical_solution,
            "prevention":          self.prevention,
            "severity":            self.severity,
            "affected_part":       self.affected_part,
            "scientific_name":     self.scientific_name,
            "recommended_products": self.recommended_products,
            "images":              self.images,
            "videos":              self.videos,
            "references":          self.references,
            "language":            self.language,
            "error":               self.error,
        }


def _not_found_result(crop: str, category: str, class_name: str, reason: str) -> KnowledgeResult:
    log.warning("Knowledge lookup failed [%s / %s / %s]: %s", crop, category, class_name, reason)
    return KnowledgeResult(found=False, crop=crop, category=category, class_name=class_name, error=reason)


# =============================================================================
# SECTION 3 — DOCUMENT MAPPER
# =============================================================================

def _map_document(doc: dict, crop: str, category: str, class_name: str) -> KnowledgeResult:
    def _str(key: str) -> str:
        val = doc.get(key)
        return str(val).strip() if val else ""

    def _list(key: str) -> list[str]:
        val = doc.get(key)
        if isinstance(val, list):
            return [str(v) for v in val if v]
        return []

    # diseasepestsolutions field mapping
    symptoms  = _str("symptoms")
    organic   = _str("organicSolution")
    chemical  = _str("chemicalSolution")
    prevention = _str("preventiveMeasures")
    images    = _list("referenceImages")
    references = _list("tags")

    return KnowledgeResult(
        found=True,
        crop=crop,
        category=category,
        class_name=class_name,
        description=_str("description"),
        symptoms=symptoms,
        causes=_str("recordType"),
        organic_solution=organic,
        chemical_solution=chemical,
        prevention=prevention,
        severity=_str("severity"),
        affected_part="",
        scientific_name="",
        recommended_products=_str("recommendedProducts"),
        images=images,
        videos=[],
        references=references,
        language="en",
        error=None,
        raw=None,
    )


# =============================================================================
# SECTION 4 — KNOWLEDGE SERVICE
# =============================================================================

class KnowledgeService:
    """
    Queries MongoDB to retrieve agronomic knowledge for a given prediction.
    Read-only. Never writes to MongoDB.
    """

    def __init__(self, config: Optional[MongoDBConfig] = None) -> None:
        self._config = config or MongoDBConfig()
        self._client: Optional[Any] = None
        log.info(
            "KnowledgeService initialised — db=%s  collection=%s",
            self._config.db_name, self._config.collection,
        )

    def _get_collection(self) -> Any:
        try:
            import pymongo
        except ImportError:
            raise ImportError("pymongo is required. Install: pip install pymongo")

        if self._client is None:
            self._client = pymongo.MongoClient(
                self._config.uri,
                serverSelectionTimeoutMS=self._config.timeout_ms,
                socketTimeoutMS=self._config.timeout_ms,
                connectTimeoutMS=self._config.timeout_ms,
                maxPoolSize=10,
            )
            atexit.register(self.close)
            log.info("MongoDB client created — uri=%s", self._config.uri)

        return self._client[self._config.db_name][self._config.collection]

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
            log.info("MongoDB connection closed")

    def lookup(
        self,
        crop: str,
        category: str,
        class_name: str,
        language: str = "en",
    ) -> KnowledgeResult:
        if not crop and not class_name:
            return _not_found_result(crop, category, class_name, "crop and class_name are both empty")

        try:
            collection = self._get_collection()
        except ImportError as exc:
            return _not_found_result(crop, category, class_name, str(exc))
        except Exception as exc:
            return _not_found_result(crop, category, class_name, f"MongoDB connection failed: {exc}")

        try:
            doc = self._query(collection, crop, class_name)
        except Exception as exc:
            return _not_found_result(crop, category, class_name, f"MongoDB query error: {exc}")

        if doc is None:
            return _not_found_result(
                crop, category, class_name,
                f"No knowledge record found for crop='{crop}' class='{class_name}'",
            )

        result = _map_document(doc, crop, category, class_name)
        result.language = language
        log.info("Knowledge lookup: %s / %s → found=True  severity=%s", crop, class_name, result.severity or "(none)")
        return result

    def lookup_from_prediction(self, prediction: dict, language: str = "en") -> KnowledgeResult:
        if not isinstance(prediction, dict):
            return _not_found_result("", "", "", "prediction must be a dict")

        if prediction.get("status") != "success":
            return _not_found_result(
                prediction.get("crop", ""),
                prediction.get("category", ""),
                prediction.get("class_name", ""),
                f"Prediction status is '{prediction.get('status')}' — skipping knowledge lookup",
            )

        return self.lookup(
            crop=prediction.get("crop", ""),
            category=prediction.get("category", ""),
            class_name=prediction.get("class_name", ""),
            language=language,
        )

    def _query(self, collection: Any, crop: str, class_name: str) -> Optional[dict]:
        projection = {"_id": 0}

        if crop and class_name:
            # 1. Exact aiLabel match (YOLO raw class_name stored by admin)
            doc = collection.find_one(
                {
                    "cropName":        {"$regex": f"^{_escape(crop)}$",       "$options": "i"},
                    "aiLabel":         {"$regex": f"^{_escape(class_name)}$", "$options": "i"},
                    "status":          "published",
                },
                projection,
            )
            if doc:
                return doc

        if crop and class_name:
            # 2. Exact diseasePestName match
            doc = collection.find_one(
                {
                    "cropName":        {"$regex": f"^{_escape(crop)}$",       "$options": "i"},
                    "diseasePestName": {"$regex": f"^{_escape(class_name)}$", "$options": "i"},
                    "status":          "published",
                },
                projection,
            )
            if doc:
                return doc

        if crop and class_name:
            # 3. Partial diseasePestName match
            doc = collection.find_one(
                {
                    "cropName":        {"$regex": f"^{_escape(crop)}$", "$options": "i"},
                    "diseasePestName": {"$regex": _escape(class_name),  "$options": "i"},
                    "status":          "published",
                },
                projection,
            )
            if doc:
                return doc

        if crop:
            # 4. Crop-only fallback
            doc = collection.find_one(
                {"cropName": {"$regex": f"^{_escape(crop)}$", "$options": "i"}, "status": "published"},
                projection,
            )
            if doc:
                return doc

        return None

    def health_check(self) -> dict:
        try:
            collection = self._get_collection()
            collection.database.client.admin.command("ping")
            return {
                "status":     "ok",
                "db":         self._config.db_name,
                "collection": self._config.collection,
                "error":      None,
            }
        except Exception as exc:
            return {
                "status":     "error",
                "db":         self._config.db_name,
                "collection": self._config.collection,
                "error":      str(exc),
            }


# =============================================================================
# SECTION 5 — HELPERS
# =============================================================================

def _escape(value: str) -> str:
    return re.escape(value)


# =============================================================================
# SECTION 6 — MODULE-LEVEL DEFAULT INSTANCE
# =============================================================================

default_knowledge_service: KnowledgeService = KnowledgeService()


# =============================================================================
# SECTION 7 — MAIN (CLI self-test)
# =============================================================================

if __name__ == "__main__":
    import sys

    print(f"\n{'='*60}")
    print("  AKP KnowledgeService — Self-Test")
    print(f"{'='*60}")

    svc = KnowledgeService()
    health = svc.health_check()
    print(f"\n  MongoDB health check:")
    for k, v in health.items():
        print(f"    {k:<12}: {v}")

    if health["status"] != "ok":
        print("\n  Cannot run lookup test — MongoDB not reachable.")
        print(f"{'='*60}\n")
        sys.exit(1)

    crop       = sys.argv[1] if len(sys.argv) > 1 else "green_gram"
    category   = sys.argv[2] if len(sys.argv) > 2 else "diseases"
    class_name = sys.argv[3] if len(sys.argv) > 3 else "Yellow Mosaic"

    print(f"\n  Lookup: crop='{crop}'  category='{category}'  class='{class_name}'")
    result = svc.lookup(crop=crop, category=category, class_name=class_name)

    print(f"\n  KnowledgeResult:")
    print(f"    found            : {result.found}")
    print(f"    error            : {result.error}")
    if result.found:
        print(f"    description      : {result.description[:80]}...")
        print(f"    severity         : {result.severity}")
        print(f"    scientific_name  : {result.scientific_name}")

    svc.close()
    print(f"\n{'='*60}\n")
