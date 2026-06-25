---
name: DB schema push without TTY
description: drizzle-kit push requires a TTY even with --force; use executeSql for direct schema changes in CI/non-TTY shells
---

## Rule
`drizzle-kit push` and `drizzle-kit push-force` both fail with "Interactive prompts require a TTY terminal" when run via `bash` tool. Even `--force` does not bypass all TTY checks — some confirmations (e.g., unique constraint additions on tables with data) still need TTY.

**Why:** Drizzle-kit uses interactive TTY prompts to confirm potentially destructive operations (adding unique constraints to tables with existing data). The `--force` flag bypasses truncation confirmation but not all checks.

**How to apply:** Use `executeSql` (code_execution sandbox) to run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` and `CREATE INDEX IF NOT EXISTS ...` directly instead of relying on drizzle-kit push for additive schema changes. Reserve drizzle-kit push for interactive terminal sessions only.

## Example working pattern
```js
await executeSql({ sqlQuery: `
  ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[];
  CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
` });
```
