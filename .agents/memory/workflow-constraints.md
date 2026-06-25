---
name: Workflow Constraints
description: Critical rules about the 4 Replit workflows — never create new ones, never force ports.
---

# Workflow Constraints

## The 4 workflows (never add or remove)
1. **Embedding Service** — manual, port 8000, Python FastAPI
2. **artifacts/api-server: API Server** — artifact-managed, port 8080 (API_PORT=8080 in shared env)
3. **artifacts/marketplace: web** — artifact-managed, Replit-assigned port (DO NOT set PORT=)
4. **artifacts/mobile: expo** — artifact-managed, Replit-assigned port (DO NOT set PORT=)

**Why:** PORT env var in shared config causes api-server conflict. Marketplace and expo use Replit's artifact system which assigns ports dynamically.
**How to apply:** If tempted to add a workflow or change ports, stop and re-read this.
