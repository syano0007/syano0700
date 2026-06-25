---
name: Courier availability columns
description: The couriers table requires 3 availability columns that were missing from schema.sql and run-migrations.ts.
---

**Rule:** The `couriers` table must have: `availability_status TEXT DEFAULT 'OFFLINE'`, `is_accepting_deliveries BOOLEAN DEFAULT FALSE`, `last_availability_change_at TIMESTAMPTZ`.

**Why:** These columns were added in V3.2 (Courier Availability system) but never added to schema.sql or the run-migrations.ts CREATE TABLE block. bootstrapTestAccounts() crashes with "column does not exist" without them.

**How to apply:**
- Both schema.sql and run-migrations.ts have now been fixed (June 17, 2026)
- run-migrations.ts V3.2 block: `ALTER TABLE couriers ADD COLUMN IF NOT EXISTS availability_status ...` — placed BEFORE the V3.3 lat/lng block
- If courier bootstrap fails with "column X does not exist": run `ALTER TABLE couriers ADD COLUMN IF NOT EXISTS X ...` via executeSql, then restart API
