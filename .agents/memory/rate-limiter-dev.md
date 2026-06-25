---
name: Rate limiter dev pattern
description: In-memory rate limiter resets on API restart; test scripts that login multiple times will trigger 429
---

# Rate Limiter Behavior in Dev

**Rule:** When writing test scripts that call `/api/auth/login` multiple times, space the calls out or restart the API server between runs.

**Why:** The rate limiter is in-memory (not Redis). It limits login attempts per IP per window. Running 4 rapid logins in a test script (admin + seller + customer + courier) can exhaust the window, making all subsequent logins return 429, leaving all tokens empty ("ERR:Too many login attempts...") and all authenticated route checks fail with 401.

**How to apply:**
- Log in once per role at the start of a test script and reuse the token
- If tokens are 0 length or start with "ERR:", the rate limiter is the cause
- Restart the API server to instantly reset all rate limit counters: `restart_workflow("artifacts/api-server: API Server")`
- For audit scripts: single login per account, ~1s apart — don't login 4 accounts in parallel subshells
