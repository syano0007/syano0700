---
name: Python Install Quirk
description: Python package install on Replit; pip --user in 3 passes; uv/pyproject fails; embedding service must be restarted after install.
---

# Python Install Quirk (Replit + PyTorch)

**Rule:** Use `pip install --user` in 3 separate passes. Do NOT use `uv`, `pyproject.toml`, `python3 -m pip install` (PEP 668 block), or `installLanguagePackages()` callback (uses uv internally → fails).

**Why:**
1. Replit's NixOS enforces PEP 668 — `python3 -m pip install` is blocked with "externally-managed-environment" error.
2. `pip install --user` uses the `.pythonlibs/` pip wrapper, which writes to `.pythonlibs/lib/python3.11/site-packages/` — always on PYTHONPATH.
3. `uv`/`pyproject.toml` resolution fails with "unsatisfiable" due to `sentence-transformers` linux platform markers conflicting with uv's resolver.
4. `installLanguagePackages()` code_execution callback also fails (uses uv internally).
5. PyTorch MUST use `--index-url https://download.pytorch.org/whl/cpu` — the plain PyPI torch package may not resolve correctly.

**How to apply — 3 passes (confirmed working 2026-06-23):**
```bash
# Pass 1 — core packages
pip install --user numpy fastapi uvicorn scikit-learn pydantic

# Pass 2 — PyTorch CPU (explicit index required)
pip install --user torch --index-url https://download.pytorch.org/whl/cpu

# Pass 3 — ML packages (depend on torch)
pip install --user transformers sentence-transformers sentencepiece safetensors
```

**CRITICAL:** After installing Python packages, **restart the Embedding Service workflow** so it picks up sentence-transformers. Without restart it stays on tfidf-lsa fallback.

**Packages install into:** `.pythonlibs/lib/python3.11/site-packages/` — always in sys.path on Replit.
