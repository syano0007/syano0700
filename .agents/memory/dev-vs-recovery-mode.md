---
name: Dev vs Recovery Mode
description: When to run audits/certification vs just building features
---

# Dev vs Recovery Mode

## Default: NORMAL DEVELOPMENT MODE
When user asks for a feature, bug fix, or improvement — just do it.

**NEVER run during normal development:**
- Workflow audits
- Environment certification
- Recovery compliance reports
- AGENT_BOOTSTRAP.md / RECOVERY_GUIDE.md reads
- Workflow scanning / cleanup passes

## IMPORT / RECOVERY MODE — only activated when user explicitly says:
- "Import the project"
- "Recover the project"
- "Restore from backup"
- "New Replit workspace"
- "Environment migration / runtime recovery / rebuild environment"

**Only then activate:**
- AGENT_BOOTSTRAP.md
- RECOVERY_GUIDE.md
- WORKFLOW_AUDIT.md
- RECOVERY_COMPLIANCE_REPORT.md
- Full certification process

**Why:** The workflow/audit rules exist for infrastructure repair only. Running them on every feature task wastes time and context.

**How to apply:** Read the user's message first. If it's a feature request → build it. If it matches one of the explicit recovery trigger phrases → certification mode.
