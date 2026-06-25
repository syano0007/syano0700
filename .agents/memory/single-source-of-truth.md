---
name: Single Source of Truth
description: SYANO_MASTER_RECOVERY.md is the only recovery file; all others redirect to it.
---

# Single Source of Truth

**Rule:** `SYANO_MASTER_RECOVERY.md` is the only authoritative recovery document for SYANO. All other docs contain only a redirect pointer.

**Why:** Multiple rounds of consolidation collapsed AGENT_BOOTSTRAP.md, RECOVERY_GUIDE.md, PROJECT_STATE.md, DATABASE_CERTIFICATION.md, MASTER_RECOVERY_VALIDATION.md, SYANO_MASTER_CERTIFICATE.md into one file to eliminate conflicting recovery logic across migrations.

**How to apply:** On any new session, read `SYANO_MASTER_RECOVERY.md` first and only. Do not read any other doc for recovery information — they intentionally contain nothing useful beyond a redirect.

**Files that redirect (contain no recovery logic):**
- AGENT_BOOTSTRAP.md → redirect only
- RECOVERY_GUIDE.md → redirect only
- PROJECT_STATE.md → redirect only
- replit.md → redirect + user preferences
- project.manifest.json → `{"recoveryFile": "SYANO_MASTER_RECOVERY.md"}`
