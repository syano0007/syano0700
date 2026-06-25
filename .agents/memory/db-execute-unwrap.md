---
name: db.execute QueryResult destructuring
description: Drizzle db.execute() returns a QueryResult object, not an iterable array — never destructure directly
---

# db.execute() Result Unwrapping

**Rule:** `db.execute(sql)` returns a `QueryResult` object (shape: `{rows: any[], ...}`), not a plain array. Never use `const [row] = await db.execute(...)`.

**Why:** Array destructuring on a non-iterable throws "is not iterable" at runtime. This bit us in `GET /dashboard/seller/metrics` which crashed on every call until fixed.

**How to apply:**
```typescript
// WRONG — crashes with "is not iterable"
const [row] = await db.execute(rawSql);

// CORRECT — safe for both driver behaviors
const rawResult = await db.execute(rawSql);
const r = rawResult.rows?.[0] ?? (rawResult as any)[0] ?? {};
```

The driver may return either `{rows: [...]}` or a bare array depending on the pg driver version/config, so the double-fallback pattern is safest.
