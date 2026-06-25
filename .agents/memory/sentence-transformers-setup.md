---
name: Sentence-transformers embedding setup
description: How to install torch+sentence-transformers and load the paraphrase-multilingual-MiniLM-L12-v2 model on Replit; critical gotchas about model format and torch version.
---

## Model
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` — 384-dim, Arabic+English multilingual.
Located at: `artifacts/embedding-service/model/` (all tokenizer files + `model.safetensors` 449MB).

## Installation
- **MUST** use `pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu` and `pip install --no-cache-dir sentence-transformers` directly.
- **NEVER** use Replit package manager (uv) for torch/sentence-transformers — it reports "no solution found" on Linux.
- torch 2.4.0+cpu works and is installed. `import torch; torch.tensor([1.0])` confirms it works.

## Critical: model format
- **Use `model.safetensors`**, NOT `pytorch_model.bin`.
- sentence-transformers v5.5+ blocks loading `pytorch_model.bin` when torch < 2.6 due to CVE-2025-32434.
- `model.safetensors` has no such restriction and works with torch 2.4.0+cpu.

## Download command
```bash
curl -L -o artifacts/embedding-service/model/model.safetensors \
  "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/model.safetensors"
```

## Loading from local disk
```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("artifacts/embedding-service/model")
```
Load time: ~10 seconds on Replit CPU.

## Recovery if model.safetensors is missing
1. Download with curl -L (above command) — ~449MB, takes ~5s at Replit speed
2. Restart "Embedding Service" workflow
3. Reset embeddings: `UPDATE products SET embedding=NULL, embedding_model=NULL, embedded_at=NULL`
4. Run backfill: `pnpm --filter @workspace/api-server embed:generate`

## Fallback behavior
main.py checks `_model_files_complete()` (file >100MB) at startup.
If missing → loads TF-IDF+LSA fallback silently. Never crashes.
`GET /health` returns `backend: "tfidf-lsa"` or `backend: "sentence-transformers"`.

**Why:** Graceful degradation ensures the embedding service always returns valid 384-dim vectors even during recovery, so the API server never loses semantic search entirely.
