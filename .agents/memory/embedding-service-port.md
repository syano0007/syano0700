---
name: Embedding service port config
description: The embedding service must run on port 8000, not 8001. Workflow command and env var details.
---

**Rule:** Embedding service MUST run on port 8000.

**Why:** .replit sets `EMBEDDING_SERVICE_URL=http://localhost:8000` and maps `localPort=8000`. Port 8001 is not in Replit's supported port list (3000,3001,3002,3003,4200,5000,5173,6000,6800,8000,8008,8080,8099,9000).

**How to apply:**
- Workflow command: `cd artifacts/embedding-service && EMBEDDING_PORT=8000 python main.py`
- waitForPort: 8000, outputType: console
- main.py defaults to port 8001 via `EMBEDDING_PORT` env var — always override with EMBEDDING_PORT=8000
- RECOVERY_GUIDE.md previously listed port 8001 (wrong) — now corrected to port 8000
- To check service: `curl http://localhost:8000/health` → `{"status":"ok","backend":"tfidf-lsa"}`
