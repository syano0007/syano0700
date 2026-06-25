---
name: Drizzle raw SQL array pattern
description: How to correctly pass JS arrays into Drizzle raw sql`` template queries (ANY vs IN, sql.join pattern).
---

## Rule
`sql.array()` does **not exist** in Drizzle ORM. Using it causes `TypeError: sql.array is not a function` at runtime.

## Correct pattern for raw SQL with arrays
```ts
// Given: const ids: number[] = [1, 2, 3]
const idsList = sql.join(ids.map((id) => sql`${id}`), sql`, `);

// Use IN (...) not ANY(array):
sql`WHERE conversation_id IN (${idsList})`
```

## Guard
Always add an early-return before the list is built if the array could be empty:
```ts
if (!ids.length) { res.json([]); return; }
```
Because `IN ()` (empty list) is invalid SQL.

**Why:** Drizzle's `sql` tag parameterizes values individually; it has no helper for producing a PostgreSQL array parameter. `sql.join` with `sql`, `` is the documented way to build a parameterized list.

**How to apply:** Any time raw `sql``...`` contains an array—replace `= ANY(${sql.array(...)})` with `IN (${sql.join(...)})`.
