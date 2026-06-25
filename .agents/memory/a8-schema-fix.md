---
name: A8 courier_ratings unique constraint
description: courier_ratings table was missing a unique constraint on (mission_id, customer_id) — required for deduplication in the rate-courier API. Applied via direct SQL ALTER TABLE.
---

**Rule:** When creating a rating table with `onConflictDoUpdate`, always add a uniqueIndex in the Drizzle schema AND verify it exists in the actual DB table. `drizzle-kit push` does not apply to environments where the DB has migration-added columns not in the base schema file.

**Why:** `courier_ratings` was created with only index (non-unique) on mission_id and courier_id. The API's `onConflictDoUpdate` targeting (mission_id, customer_id) silently fails with a DB error because no unique constraint existed. The fix was: `ALTER TABLE courier_ratings ADD CONSTRAINT uq_courier_ratings_mission_customer UNIQUE (mission_id, customer_id);`

**How to apply:** After adding any table with `onConflictDoUpdate`, verify the constraint exists via `\d <table>` and confirm the "Unique" index appears. Never rely on `drizzle-kit push` in this project — it detects migration-added columns as "data loss" and requires interactive confirmation.
