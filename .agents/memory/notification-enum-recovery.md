---
name: notification_type enum recovery
description: schema.sql has only 17 of 31 notification_type enum values; the 14 delivery/courier types are now auto-added by run-migrations.ts on startup
---

# notification_type Enum Recovery

**RESOLVED:** The 14 missing enum values are now added automatically by `run-migrations.ts` on every server startup (added in Recovery Integrity Audit). No manual SQL required after a schema.sql restore.

**Rule:** Start the API server after schema restore. It automatically patches all three enums:
- `role`: adds `courier`
- `order_status`: adds 9 delivery statuses
- `notification_type`: adds 14 courier/delivery/trust values

**Legacy fallback (if API fails to start):** Run the SQL block manually from RECOVERY_GUIDE.md Step 3.

**Why:** The 14 missing values were added iteratively after the initial schema export. They cannot be in schema.sql (PostgreSQL restriction: enum changes cannot run in transactions). Moving them to run-migrations.ts makes recovery zero-intervention.

**Verify after startup:**
```sql
SELECT COUNT(*) FROM unnest(enum_range(NULL::notification_type)); -- expect 31
SELECT COUNT(*) FROM unnest(enum_range(NULL::order_status));       -- expect 15
```
