"""
SYANO — Multilingual Embedding Service
Loads paraphrase-multilingual-MiniLM-L12-v2 from local disk via sentence-transformers.
Falls back to TF-IDF+LSA if the model file is missing (graceful degradation — never crashes).

API contract (unchanged):
  GET  /health         → {status, model, vector_dimensions, backend, load_ms}
  POST /embed/query    → {text} → {embedding, dimensions, processing_ms}
  POST /embed/batch    → {texts, type} → {embeddings, count, processing_ms}

Port: 8001 (set via EMBEDDING_PORT env var)
"""

import os
import time
import logging
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
VECTOR_DIMENSIONS = 384

# ─── Backend (loaded at startup) ─────────────────────────────────────────────

_backend: str = "unloaded"
_load_ms: int = 0
_st_model = None          # SentenceTransformer instance
_tfidf_embedder = None    # fallback TF-IDF embedder


# ─── TF-IDF Fallback (activated only when pytorch_model.bin is missing) ──────

SEED_CORPUS = [
    # Electronics
    "هاتف ذكي سامسونج جالاكسي", "موبايل آيفون أبل", "لابتوب كمبيوتر محمول",
    "سماعات لاسلكية بلوتوث سوني", "تلفزيون شاشة ذكي سامسونج QLED", "تابلت آيباد برو",
    "samsung galaxy smartphone mobile phone", "apple iphone ios smartphone",
    "apple macbook laptop computer", "sony wireless headphones bluetooth",
    # Fashion
    "فستان سهرة حفلة", "عباءة نيدا خليجية", "بنطلون جينز رجالي",
    "حذاء كعب عالي نسائي", "حقيبة يد جلد فاخرة", "جاكيت جلد رجالي",
    "بواط حذاء سبور رياضي", "شنط حقائب نسائي",
    "evening dress wedding gown", "leather handbag purse designer",
    "jeans pants men denim", "sneakers running shoes nike adidas",
    # Beauty
    "عطر رجالي ديور سوفاج", "عطر نسائي شانيل", "كريم ترطيب بشرة",
    "برفانات عطور فاخرة", "كريمات مرطبات عناية",
    "dior sauvage men perfume cologne", "chanel perfume women fragrance",
    "moisturizer face cream skincare", "luxury perfume fragrance",
    # Home
    "أريكة كنبة صالة", "طاولة طعام خشب", "مصباح إضاءة", "سجادة",
    "sofa couch living room", "dining table wooden", "floor lamp lighting",
    # Sports
    "دمبل أوزان رياضة", "حصيرة يوغا", "دراجة ثابتة رياضة",
    "dumbbells weights fitness", "yoga mat non-slip", "exercise bike home gym",
    # Intent modifiers
    "رخيص سعر منخفض مناسب", "فاخر أصلي عالي الجودة",
    "جديد وصل حديثاً أحدث", "هدية مناسب الشتاء الصيف",
    "cheap affordable budget low price", "luxury premium high quality",
    "new arrival latest version", "gift winter summer seasonal",
    "best rated recommended bestselling",
]


def _load_tfidf_fallback() -> object:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.decomposition import TruncatedSVD
    from sklearn.preprocessing import normalize as sk_normalize

    class TFIDFEmbedder:
        def __init__(self):
            self.vectorizer = TfidfVectorizer(
                analyzer="char_wb", ngram_range=(2, 4),
                max_features=50_000, sublinear_tf=True, lowercase=True,
            )
            X = self.vectorizer.fit_transform(SEED_CORPUS)
            n_feat = X.shape[1]
            dims = min(VECTOR_DIMENSIONS, n_feat - 1)
            self.svd = TruncatedSVD(n_components=dims, random_state=42)
            self.svd.fit(X)
            self._dims = dims

        def embed(self, texts: list) -> list:
            X = self.vectorizer.transform(texts)
            v = self.svd.transform(X)
            if v.shape[1] < VECTOR_DIMENSIONS:
                pad = np.zeros((v.shape[0], VECTOR_DIMENSIONS - v.shape[1]))
                v = np.hstack([v, pad])
            return sk_normalize(v, norm="l2").tolist()

    return TFIDFEmbedder()


def _model_files_complete() -> bool:
    """Return True only if pytorch_model.bin (or model.safetensors) is present and >100MB."""
    for fname in ("pytorch_model.bin", "model.safetensors"):
        fpath = os.path.join(MODEL_DIR, fname)
        if os.path.exists(fpath) and os.path.getsize(fpath) > 100_000_000:
            return True
    return False


# ─── Startup ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _backend, _load_ms, _st_model, _tfidf_embedder

    t0 = time.time()

    if _model_files_complete():
        try:
            logger.info(f"[embeddings] Loading transformer model from {MODEL_DIR}")
            from sentence_transformers import SentenceTransformer
            _st_model = SentenceTransformer(MODEL_DIR)
            _load_ms = int((time.time() - t0) * 1000)
            _backend = "sentence-transformers"
            logger.info(f"[embeddings] ✅ Transformer model loaded in {_load_ms}ms — backend: sentence-transformers")
        except Exception as e:
            logger.error(f"[embeddings] ❌ Failed to load transformer model: {e}")
            logger.warning("[embeddings] Falling back to TF-IDF+LSA")
            _tfidf_embedder = _load_tfidf_fallback()
            _load_ms = int((time.time() - t0) * 1000)
            _backend = "tfidf-lsa"
    else:
        missing = []
        for fname in ("pytorch_model.bin", "model.safetensors"):
            fpath = os.path.join(MODEL_DIR, fname)
            if not os.path.exists(fpath):
                missing.append(fname)
            elif os.path.getsize(fpath) < 100_000_000:
                missing.append(f"{fname} (incomplete — {os.path.getsize(fpath)//1024//1024}MB)")
        logger.warning(f"[embeddings] Model weights not ready: {missing}")
        logger.warning("[embeddings] Using TF-IDF+LSA fallback. Restart after pytorch_model.bin finishes downloading.")
        _tfidf_embedder = _load_tfidf_fallback()
        _load_ms = int((time.time() - t0) * 1000)
        _backend = "tfidf-lsa"

    logger.info(f"[embeddings] Service ready — backend={_backend} load_ms={_load_ms}")
    yield
    _st_model = None
    _tfidf_embedder = None


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="SYANO Embedding Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response models ────────────────────────────────────────────────

class QueryEmbedRequest(BaseModel):
    text: str
    language: Optional[str] = None


class BatchEmbedRequest(BaseModel):
    texts: list[str]
    type: str = "passage"


# ─── Embed helper ─────────────────────────────────────────────────────────────

def _embed_texts(texts: list[str]) -> list[list[float]]:
    if _st_model is not None:
        vecs = _st_model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        # L2 normalize
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        vecs = vecs / norms
        return vecs.tolist()
    elif _tfidf_embedder is not None:
        return _tfidf_embedder.embed(texts)
    else:
        raise RuntimeError("No embedder loaded")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    ready = _st_model is not None or _tfidf_embedder is not None
    return {
        "status": "ok" if ready else "initializing",
        "model": MODEL_NAME,
        "vector_dimensions": VECTOR_DIMENSIONS,
        "backend": _backend,
        "load_ms": _load_ms,
    }


@app.post("/embed/query")
def embed_query(req: QueryEmbedRequest):
    if _st_model is None and _tfidf_embedder is None:
        raise HTTPException(status_code=503, detail="Embedder initializing")
    t0 = time.time()
    try:
        result = _embed_texts([req.text])
        return {
            "embedding": result[0],
            "dimensions": len(result[0]),
            "processing_ms": int((time.time() - t0) * 1000),
        }
    except Exception as e:
        logger.error(f"embed/query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed/batch")
def embed_batch(req: BatchEmbedRequest):
    if _st_model is None and _tfidf_embedder is None:
        raise HTTPException(status_code=503, detail="Embedder initializing")
    if not req.texts:
        return {"embeddings": [], "count": 0, "processing_ms": 0}

    t0 = time.time()
    MAX_BATCH = 64
    all_embeddings: list[list[float]] = []

    for i in range(0, len(req.texts), MAX_BATCH):
        chunk = req.texts[i: i + MAX_BATCH]
        try:
            all_embeddings.extend(_embed_texts(chunk))
        except Exception as e:
            logger.error(f"embed/batch chunk {i} error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return {
        "embeddings": all_embeddings,
        "count": len(all_embeddings),
        "processing_ms": int((time.time() - t0) * 1000),
    }


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("EMBEDDING_PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, workers=1, timeout_keep_alive=120)
