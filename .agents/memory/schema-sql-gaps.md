---
name: schema.sql delivery_missions gap
description: schema.sql was missing delivery_missions table and enums; now fixed. Covers what's in schema.sql vs run-migrations.ts.
---

**Rule:** schema.sql must include `delivery_missions` table + `delivery_mission_status` enum + `delivery_size` enum.

**Why:** delivery_missions was in Drizzle schema and referenced by run-migrations.ts V3.3 ALTER TABLE, but missing from schema.sql. Fresh-env recovery (`psql -f schema.sql`) would produce a table that run-migrations.ts then fails to ALTER.

**What lives where:**
- schema.sql (21 base tables): users, products, orders, order_items, cart_items, product_variants, notifications, messages, conversations, reviews, seller_applications, seller_reviews, store_follows, platform_settings, push_subscriptions, verification_audit_log, admin_audit_log, product_variant_groups/options/values, + delivery_missions (added June 17, 2026)
- run-migrations.ts creates: delivery_zones, couriers, courier_assignments, courier_wallet_transactions, variant_images, order_status_history, wishlists, hero_banners, search_synonyms, query_logs, support_tickets, mission_offers, dispatch_alerts, seller_verification_log, message_attachments + all additive ALTERs
