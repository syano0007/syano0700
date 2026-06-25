import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, reviewsTable, productsTable, usersTable, ordersTable, orderItemsTable } from "@workspace/db";
import { ListReviewsParams, CreateReviewParams, CreateReviewBody } from "@workspace/api-zod";
import { requireAuth, requireRole, requireActiveAccount } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListReviewsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const reviews = await db
    .select({
      id: reviewsTable.id,
      productId: reviewsTable.productId,
      userId: reviewsTable.userId,
      userName: usersTable.name,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .innerJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
    .where(eq(reviewsTable.productId, params.data.id))
    .orderBy(reviewsTable.createdAt);

  res.json(
    reviews.map((r) => ({
      ...r,
      comment: r.comment ?? null,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/products/:id/reviews", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateReviewParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const userId = req.user!.userId;

  const [existing] = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.productId, params.data.id), eq(reviewsTable.userId, userId)));

  if (existing) {
    res.status(409).json({ error: "You have already reviewed this product" });
    return;
  }

  const deliveredOrders = await db
    .select({ orderId: ordersTable.id })
    .from(ordersTable)
    .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        eq(ordersTable.customerId, userId),
        eq(ordersTable.status, "delivered"),
        eq(orderItemsTable.productId, params.data.id)
      )
    )
    .limit(1);

  if (deliveredOrders.length === 0) {
    res.status(403).json({ error: "You can only review products from delivered orders" });
    return;
  }

  const [inserted] = await db
    .insert(reviewsTable)
    .values({
      productId: params.data.id,
      userId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    })
    .returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({
    id: inserted.id,
    productId: inserted.productId,
    userId: inserted.userId,
    userName: user?.name ?? "Unknown",
    rating: inserted.rating,
    comment: inserted.comment ?? null,
    createdAt: inserted.createdAt.toISOString(),
  });
});

export default router;
