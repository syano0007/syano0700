import { Router, type IRouter } from "express";
import { eq, and, avg, count, isNull, inArray } from "drizzle-orm";
import { db, cartItemsTable, productsTable, usersTable, reviewsTable, productVariantsTable } from "@workspace/db";
import {
  AddToCartBody,
  UpdateCartItemBody,
  BatchUpdateCartBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { requireAuth, requireRole, requireActiveAccount } from "../middlewares/auth";
import { buildVariantData } from "./variants";

const router: IRouter = Router();

const DELIVERY_FEE = 0;

function computeFinalPrice(price: string, discountPercent: string | null, priceAdjustment = 0): number {
  const p = parseFloat(price) + priceAdjustment;
  if (!discountPercent) return parseFloat(p.toFixed(2));
  const d = parseFloat(discountPercent);
  if (d <= 0 || d > 100) return parseFloat(p.toFixed(2));
  return parseFloat((p * (1 - d / 100)).toFixed(2));
}

type VariantInfo = {
  id: number; sku: string | null; priceAdjustment: number; stock: number;
  imageUrl: string | null; label: string;
  options: { groupName: string; value: string }[];
};

/** Build a variantId → VariantInfo map for all cart items that carry a variant.
 *  Calls buildVariantData once per unique productId (not once per cart item). */
async function batchVariantMap(
  items: Array<{ productId: number; variantId: number | null }>
): Promise<Map<number, VariantInfo>> {
  const variantItems = items.filter((i) => i.variantId !== null);
  if (variantItems.length === 0) return new Map();

  const uniqueProductIds = [...new Set(variantItems.map((i) => i.productId))];
  const results = await Promise.all(uniqueProductIds.map((pid) => buildVariantData(pid)));

  const map = new Map<number, VariantInfo>();
  for (const { variants } of results) {
    for (const v of variants) {
      map.set(v.id, {
        id: v.id,
        sku: v.sku,
        priceAdjustment: v.priceAdjustment,
        stock: v.stock,
        imageUrl: v.imageUrl,
        label: v.label,
        options: v.options.map((o) => ({ groupName: o.groupName, value: o.value })),
      });
    }
  }
  return map;
}

async function buildCartResponse(userId: number) {
  const items = await db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.userId, userId));

  if (items.length === 0) {
    return { items: [], subtotal: 0, discount: 0, deliveryFee: DELIVERY_FEE, total: DELIVERY_FEE, itemCount: 0 };
  }

  // Batch-fetch products and ratings in parallel — was 3 queries per cart item.
  const productIds = [...new Set(items.map((i) => i.productId))];

  const [productRows, ratingRows] = await Promise.all([
    db.select().from(productsTable).where(inArray(productsTable.id, productIds)),
    db.select({
        productId:    reviewsTable.productId,
        avgRating:    avg(reviewsTable.rating),
        totalReviews: count(reviewsTable.id),
      })
      .from(reviewsTable)
      .where(inArray(reviewsTable.productId, productIds))
      .groupBy(reviewsTable.productId),
  ]);

  const productMap = new Map(productRows.map((p) => [p.id, p]));
  const ratingMap  = new Map(ratingRows.map((r) => [r.productId, r]));

  // Batch-fetch sellers using the deduplicated seller IDs from the products.
  const sellerIds = [...new Set(productRows.map((p) => p.sellerId))];
  const sellerRows = sellerIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable).where(inArray(usersTable.id, sellerIds))
    : [];
  const sellerMap = new Map(sellerRows.map((s) => [s.id, s.name]));

  // Batch-fetch ALL variant data needed by this cart in parallel per unique productId.
  // Was: 1 query per variant cart item × (1 productId lookup + 4 buildVariantData queries).
  // Now: 1 call to buildVariantData per unique productId, regardless of cart size.
  const variantById = await batchVariantMap(items);

  const cartItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;

      const variantData: VariantInfo | null = item.variantId
        ? (variantById.get(item.variantId) ?? null)
        : null;

      const ratingRow      = ratingMap.get(item.productId);
      const priceAdj       = variantData?.priceAdjustment ?? 0;
      const effectiveStock = variantData ? variantData.stock : product.stock;
      const finalPrice     = computeFinalPrice(product.price, product.discountPercent, priceAdj);
      const originalPrice  = parseFloat(product.price) + priceAdj;
      const stockWarning   = item.quantity > effectiveStock;

      return {
        cartItemId: item.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        variantLabel: variantData?.label ?? null,
        variantDetails: variantData?.options ?? null,
        variantImageUrl: variantData?.imageUrl ?? null,
        product: {
          id:              product.id,
          sellerId:        product.sellerId,
          sellerName:      sellerMap.get(product.sellerId) ?? "Unknown",
          name:            product.name,
          description:     product.description,
          price:           originalPrice,
          discountPercent: product.discountPercent ? parseFloat(product.discountPercent) : null,
          finalPrice,
          category:        product.category,
          stock:           effectiveStock,
          imageUrl:        variantData?.imageUrl ?? product.imageUrl ?? null,
          createdAt:       product.createdAt.toISOString(),
          averageRating:   ratingRow?.avgRating ? parseFloat(String(ratingRow.avgRating)) : 0,
          reviewCount:     ratingRow?.totalReviews ?? 0,
        },
        quantity:     item.quantity,
        subtotal:     parseFloat((finalPrice * item.quantity).toFixed(2)),
        stockWarning,
      };
    });

  const validItems = cartItems.filter((i): i is NonNullable<typeof i> => i !== null);

  const subtotal = validItems.reduce((sum, i) => sum + parseFloat((i.product.price * i.quantity).toFixed(2)), 0);
  const discount = validItems.reduce((sum, i) => {
    const orig = parseFloat((i.product.price * i.quantity).toFixed(2));
    return sum + parseFloat((orig - i.subtotal).toFixed(2));
  }, 0);
  const total = parseFloat((subtotal - discount + DELIVERY_FEE).toFixed(2));
  const itemCount = validItems.reduce((sum, i) => sum + i.quantity, 0);

  return {
    items: validItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    deliveryFee: DELIVERY_FEE,
    total,
    itemCount,
  };
}

router.get("/cart", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  res.json(await buildCartResponse(req.user!.userId));
});

router.post("/cart/items", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  const parsed = AddToCartBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { productId, quantity, variantId = null } = parsed.data;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  // Validate variant belongs to product
  if (variantId) {
    const [variant] = await db.select().from(productVariantsTable)
      .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, productId)));
    if (!variant) { res.status(404).json({ error: "Variant not found" }); return; }
    if (!variant.active) { res.status(400).json({ error: "This variant is unavailable" }); return; }
  }

  // Uniqueness: (userId, productId, variantId)
  const existingQuery = variantId
    ? and(eq(cartItemsTable.userId, req.user!.userId), eq(cartItemsTable.productId, productId), eq(cartItemsTable.variantId, variantId))
    : and(eq(cartItemsTable.userId, req.user!.userId), eq(cartItemsTable.productId, productId), isNull(cartItemsTable.variantId));

  const [existing] = await db.select().from(cartItemsTable).where(existingQuery!);

  if (existing) {
    await db.update(cartItemsTable)
      .set({ quantity: existing.quantity + quantity })
      .where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({
      userId: req.user!.userId,
      productId,
      variantId: variantId ?? null,
      quantity,
    });
  }

  res.json(await buildCartResponse(req.user!.userId));
});

// Batch update — supports variantId per item
const BatchUpdateCartBodyWithVariant = z.object({
  items: z.array(z.object({
    productId: z.number(),
    variantId:  z.number().optional().nullable(),
    quantity:   z.number(),
  })),
});

router.patch("/cart/items", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  const parsed = BatchUpdateCartBodyWithVariant.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.user!.userId;
  for (const update of parsed.data.items) {
    const { productId, variantId, quantity } = update;
    const whereClause = variantId
      ? and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.productId, productId), eq(cartItemsTable.variantId, variantId))
      : and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.productId, productId), isNull(cartItemsTable.variantId));

    if (quantity < 1) {
      await db.delete(cartItemsTable).where(whereClause!);
    } else {
      const [existing] = await db.select().from(cartItemsTable).where(whereClause!);
      if (existing) {
        await db.update(cartItemsTable).set({ quantity }).where(eq(cartItemsTable.id, existing.id));
      }
    }
  }

  res.json(await buildCartResponse(userId));
});

// Single-item update by cartItemId
router.patch("/cart/items/:cartItemId", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  const cartItemId = parseInt(String(req.params.cartItemId), 10);
  if (isNaN(cartItemId)) { res.status(400).json({ error: "Invalid cart item ID" }); return; }

  const parsed = UpdateCartItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.select().from(cartItemsTable)
    .where(and(eq(cartItemsTable.id, cartItemId), eq(cartItemsTable.userId, req.user!.userId)));
  if (!item) { res.status(404).json({ error: "Cart item not found" }); return; }

  if (parsed.data.quantity < 1) {
    await db.delete(cartItemsTable).where(eq(cartItemsTable.id, cartItemId));
  } else {
    await db.update(cartItemsTable).set({ quantity: parsed.data.quantity }).where(eq(cartItemsTable.id, cartItemId));
  }

  res.json(await buildCartResponse(req.user!.userId));
});

// Delete by cartItemId
router.delete("/cart/items/:cartItemId", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  const cartItemId = parseInt(String(req.params.cartItemId), 10);
  if (isNaN(cartItemId)) { res.status(400).json({ error: "Invalid cart item ID" }); return; }

  const [item] = await db.select().from(cartItemsTable)
    .where(and(eq(cartItemsTable.id, cartItemId), eq(cartItemsTable.userId, req.user!.userId)));
  if (!item) { res.status(404).json({ error: "Cart item not found" }); return; }

  await db.delete(cartItemsTable).where(eq(cartItemsTable.id, cartItemId));
  res.json(await buildCartResponse(req.user!.userId));
});

router.delete("/cart/clear", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, req.user!.userId));
  res.json({ message: "Cart cleared" });
});

export default router;
