"""
Build FAISS indexes for ICD-10, CPT, and LOINC code mapping.
Run this once before starting the backend: python build_index.py

Loads codes from data/reference_codes.json (expanded dataset).
Falls back to a minimal embedded set if the JSON is missing.
"""
import os
import json
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

REF_CODES_PATH = os.path.join(DATA_DIR, "reference_codes.json")


def load_codes():
    """Load reference codes from JSON file or fallback to minimal embedded set."""
    if os.path.exists(REF_CODES_PATH):
        with open(REF_CODES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        icd10 = [(c[0], c[1]) for c in data.get("icd10", [])]
        cpt = [(c[0], c[1]) for c in data.get("cpt", [])]
        loinc = [(c[0], c[1]) for c in data.get("loinc", [])]
        print(f"Loaded reference_codes.json: {len(icd10)} ICD-10, {len(cpt)} CPT, {len(loinc)} LOINC")
        return icd10, cpt, loinc

    # Minimal fallback
    print("WARNING: reference_codes.json not found, using minimal embedded codes")
    icd10 = [
        ("E11.9", "Type 2 diabetes mellitus without complications"),
        ("I10", "Essential (primary) hypertension"),
        ("I21.9", "Acute myocardial infarction, unspecified"),
        ("J18.9", "Pneumonia, unspecified organism"),
        ("N17.9", "Acute kidney failure, unspecified"),
        ("A41.9", "Sepsis, unspecified organism"),
        ("R50.9", "Fever, unspecified"),
        ("R06.02", "Shortness of breath"),
    ]
    cpt = [
        ("99213", "Office or outpatient visit, established patient, low complexity"),
        ("99223", "Initial hospital care, high complexity"),
        ("85025", "Complete blood count (CBC) with differential"),
        ("80053", "Comprehensive metabolic panel"),
        ("71046", "Chest X-ray, 2 views"),
        ("93000", "Electrocardiogram (ECG/EKG), 12-lead"),
    ]
    loinc = [
        ("718-7", "Hemoglobin [Mass/volume] in Blood"),
        ("2160-0", "Creatinine [Mass/volume] in Serum or Plasma"),
        ("2345-7", "Glucose [Mass/volume] in Serum or Plasma"),
        ("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood"),
    ]
    return icd10, cpt, loinc


def build_indexes():
    from sentence_transformers import SentenceTransformer
    import faiss

    icd10_codes, cpt_codes, loinc_codes = load_codes()

    print("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    # De-duplicate codes (some datasets may have duplicates)
    for name, codes in [("icd10", icd10_codes), ("cpt", cpt_codes), ("loinc", loinc_codes)]:
        seen = set()
        unique_codes = []
        for code, desc in codes:
            if code not in seen:
                seen.add(code)
                unique_codes.append((code, desc))

        print(f"\nBuilding {name.upper()} index ({len(unique_codes)} unique codes)...")

        descriptions = [desc for _, desc in unique_codes]
        code_map = [{"code": code, "description": desc} for code, desc in unique_codes]

        # Embed descriptions
        embeddings = model.encode(descriptions, normalize_embeddings=True, show_progress_bar=True)
        embeddings = np.array(embeddings, dtype=np.float32)

        # Build FAISS index (Inner Product = cosine similarity for normalized vectors)
        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(embeddings)

        # Save
        index_path = os.path.join(DATA_DIR, f"{name}.faiss")
        map_path = os.path.join(DATA_DIR, f"{name}_map.json")

        faiss.write_index(index, index_path)
        with open(map_path, "w", encoding="utf-8") as f:
            json.dump(code_map, f, indent=2, ensure_ascii=False)

        print(f"  Saved {index_path} ({index.ntotal} vectors, {dim}D)")
        print(f"  Saved {map_path}")

    print("\nAll indexes built successfully!")


if __name__ == "__main__":
    build_indexes()
