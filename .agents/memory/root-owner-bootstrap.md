---
name: Root Owner bootstrap
description: Permanent Root Owner account identity, bootstrap logic, and protection rules for SYANO.
---

## Rule
The ONE AND ONLY permanent owner of this platform is:
- **Email:** `delewatiamer7@gmail.com`
- **Password:** `00Amer00` (env var: `ROOT_ADMIN_PASSWORD`, fallback hardcoded)

**Why:** User explicitly established this as the immutable root identity that must survive database resets, migrations, workspace transfers, and recovery sessions. No other bootstrap admin should ever exist.

## How to apply
- Every recovery session: verify this account exists with role=admin, account_status=active, is_verified=true.
- Never create a different bootstrap admin identity.
- The API server self-heals this account on every startup via `bootstrapRootAdmin()` in `artifacts/api-server/src/lib/bootstrap-admin.ts`.
- Exported constant for guards: `ROOT_OWNER_EMAIL` from that same file.

## Bootstrap behavior
1. Detects legacy typo account `delewaitamer7@gmail.com` → logs it
2. Creates/repairs correct account `delewatiamer7@gmail.com`
3. Deletes legacy typo account
4. Logs one of: "Root Owner bootstrapped (created)" | "Root Owner repaired" | "Root Owner healthy"

## Protection
- `DELETE /api/admin/users/:id` → 403 if target email = `delewatiamer7@gmail.com`
- `POST /api/admin/users/:id/suspend` → already blocked (admin role guard)
- No UI path can delete or demote this account
