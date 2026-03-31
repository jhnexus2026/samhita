"""FAISS Vector Search — Medical Code Mapping Service"""
import os
import json
import logging
import numpy as np

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

# Global caches — loaded once
_model = None
_indexes = {}
_code_maps = {}


def _get_model():
    """Lazy-load the sentence-transformers model."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _load_index(code_system: str):
    """Load FAISS index and code mapping for a given system."""
    import faiss

    if code_system in _indexes:
        return _indexes[code_system], _code_maps[code_system]

    index_path = os.path.join(DATA_DIR, f"{code_system}.faiss")
    map_path = os.path.join(DATA_DIR, f"{code_system}_map.json")

    if not os.path.exists(index_path) or not os.path.exists(map_path):
        logger.warning(f"Index not found for {code_system}. Run build_index.py first.")
        return None, None

    index = faiss.read_index(index_path)
    with open(map_path, "r", encoding="utf-8") as f:
        code_map = json.load(f)

    _indexes[code_system] = index
    _code_maps[code_system] = code_map

    return index, code_map


def _entity_type_to_code_system(entity_type: str) -> str:
    """Map entity type to the appropriate code system."""
    mapping = {
        "DIAGNOSIS": "icd10",
        "PROCEDURE": "cpt",
        "LAB_TEST": "loinc",
    }
    return mapping.get(entity_type)


def map_entity(entity: dict) -> dict:
    """Map a single clinical entity to its closest medical code using vector search."""
    entity_type = entity.get("entity_type", "")
    code_system = _entity_type_to_code_system(entity_type)

    # Only map DIAGNOSIS, PROCEDURE, and LAB_TEST
    if not code_system:
        return {
            **entity,
            "coded_value": None,
            "code_system": None,
            "code_description": None,
            "similarity_score": 0.0,
            "needs_review": False,
        }

    index, code_map = _load_index(code_system)
    if index is None:
        logger.warning(f"No FAISS index for {code_system}, skipping mapping")
        return {
            **entity,
            "coded_value": None,
            "code_system": code_system.upper(),
            "code_description": None,
            "similarity_score": 0.0,
            "needs_review": True,
        }

    # Embed the entity text
    model = _get_model()
    search_text = entity.get("normalized_value") or entity.get("entity_text", "")
    query_embedding = model.encode([search_text], normalize_embeddings=True)

    # Search top 3 matches
    scores, indices = index.search(query_embedding.astype(np.float32), min(3, index.ntotal))

    if len(indices[0]) == 0 or indices[0][0] == -1:
        return {
            **entity,
            "coded_value": None,
            "code_system": code_system.upper(),
            "code_description": None,
            "similarity_score": 0.0,
            "needs_review": True,
        }

    best_idx = int(indices[0][0])
    best_score = float(scores[0][0])

    # Look up code from the map
    code_entry = code_map[best_idx] if best_idx < len(code_map) else None
    if not code_entry:
        return {**entity, "coded_value": None, "code_system": code_system.upper(), "similarity_score": 0.0, "needs_review": True}

    needs_review = best_score < 0.85

    return {
        **entity,
        "coded_value": code_entry.get("code", ""),
        "code_system": code_system.upper(),
        "code_description": code_entry.get("description", ""),
        "similarity_score": round(best_score, 4),
        "needs_review": needs_review,
    }


def map_all_entities(entities: list[dict]) -> list[dict]:
    """Map all entities to medical codes."""
    coded = []
    for entity in entities:
        try:
            coded_entity = map_entity(entity)
            coded.append(coded_entity)
        except Exception as e:
            logger.error(f"Code mapping failed for entity: {entity.get('entity_text')}: {e}")
            coded.append({**entity, "coded_value": None, "similarity_score": 0.0, "needs_review": True})
    return coded
