---
name: Express v5 + TypeScript params pattern
description: How to handle req.params and JWT_SECRET typing issues introduced by Express v5 types
---

## Rule
Always wrap `req.params.xxx` with `String()` before passing to `parseInt()` or any string method, because Express v5 types `req.params` values as `string | string[]`.

```ts
// WRONG (TS error in Express v5):
const id = parseInt(req.params.id, 10);

// CORRECT:
const id = parseInt(String(req.params.id), 10);
```

## JWT_SECRET narrowing

Module-level `const` declarations with a conditional throw do NOT narrow the type in TypeScript when the variable is used later in exported functions. Use an IIFE to produce a narrowed `string` type:

```ts
// WRONG — TS still infers string | undefined in function bodies:
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error("...");

// CORRECT — IIFE narrows to string at declaration site:
const JWT_SECRET: string = (() => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is required");
  return s;
})();
```

**Why:** Express v5 changed the `ParamsDictionary` interface so each value is `string | string[]` instead of `string`. The IIFE pattern is the only way to get a narrow `string` type for a module-level constant that may be undefined.

**How to apply:** Apply to every `req.params` access in route files (variants.ts, products.ts, orders.ts, sellers.ts, cart.ts, messaging.ts, notifications.ts, admin.ts). Apply IIFE to JWT_SECRET in auth.ts and any other file that uses it at module scope.
