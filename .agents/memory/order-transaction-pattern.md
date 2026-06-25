---
name: Order transaction pattern
description: POST /orders uses db.transaction() with SELECT FOR UPDATE to prevent overselling; drizzle-orm/node-postgres tx.execute() returns {rows: any[]}
---

## Rule
POST /orders must wrap stock validation + insert + stock decrement + cart clear in a single `db.transaction()`. Stock rows must be locked with `SELECT FOR UPDATE` before reading their values.

## How to apply
- Use `tx.execute(sql\`SELECT ... FROM products WHERE id IN (...) FOR UPDATE\`)` to lock product rows.
- Use `tx.execute(sql\`SELECT ... FROM product_variants WHERE id IN (...) FOR UPDATE\`)` for variants.
- `(result as any).rows` is the correct access pattern for drizzle-orm/node-postgres raw execute.
- Column names from raw SQL are snake_case: `discount_percent`, `seller_id`, `price_adjustment`, `product_id`.
- Stock decrement inside transaction uses raw SQL: `UPDATE products SET stock = GREATEST(0, stock - ${qty}) WHERE id = ${id}`.
- Throw a typed error object (`Object.assign(new Error(...), { statusCode: 400, items: [...] })`) to trigger rollback; catch outside the transaction to send the HTTP response.
- Notifications (createNotification) go AFTER the transaction commit so they never block or roll back.
- Variant display data (buildVariantData) is read-only and should be fetched OUTSIDE the transaction.

**Why:** Without SELECT FOR UPDATE, two simultaneous requests both read the same stock value, both pass validation, and both decrement — causing oversells. The lock forces the second request to wait until the first transaction commits, then reads the updated (decremented) stock.
