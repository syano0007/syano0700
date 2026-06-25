---
name: product_variants DB migration
description: Missing columns in product_variants that weren't in the DB backup but are in the Drizzle schema
---

## Rule
The `product_variants` table in the restored DB backup was missing these columns that the Drizzle schema (`lib/db/src/schema/variants.ts`) declares:
- `price` NUMERIC(10,2)
- `compare_at_price` NUMERIC(10,2)
- `barcode` TEXT
- `weight_grams` INTEGER
- `dimensions` TEXT

All five are added in `artifacts/api-server/src/lib/run-migrations.ts` under the variant support DO block with `IF NOT EXISTS` guards.

**Why:** The DB backup was from an older version of the schema before these columns were added. Drizzle queries select them by name, causing a hard runtime 500 on any product detail page that has variants.

**How to apply:** If a new variant column is added to the Drizzle schema, add a corresponding `ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS` line to run-migrations.ts so it applies on next server startup without needing a TTY for drizzle-kit.
