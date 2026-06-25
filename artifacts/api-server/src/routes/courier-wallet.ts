/**
 * Courier Wallet + Payout Routes — Phase A9
 *
 * Courier:
 *   GET  /courier/wallet
 *   GET  /courier/wallet/transactions
 *   POST /courier/payouts
 *   GET  /courier/payouts
 *
 * Admin:
 *   GET  /admin/courier-payouts
 *   POST /admin/courier-payouts/:id/approve
 *   POST /admin/courier-payouts/:id/reject
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { db, pool } from "@workspace/db";
import { couriersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getOrCreateWallet,
  addEarning as _addEarning,
  requestPayout,
  approvePayout,
  rejectPayout,
} from "../services/courierWalletService";

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getCourierByUserId(userId: number) {
  const [courier] = await db.select().from(couriersTable).where(eq(couriersTable.userId, userId));
  return courier ?? null;
}

// ─── GET /courier/wallet ──────────────────────────────────────────────────────

router.get("/courier/wallet", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  const courier = await getCourierByUserId(req.user!.userId);
  if (!courier || courier.status !== "approved") { res.status(403).json({ error: "Access denied" }); return; }

  const wallet = await getOrCreateWallet(courier.id);
  res.json(wallet);
});

// ─── GET /courier/wallet/transactions ─────────────────────────────────────────

router.get("/courier/wallet/transactions", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  const courier = await getCourierByUserId(req.user!.userId);
  if (!courier || courier.status !== "approved") { res.status(403).json({ error: "Access denied" }); return; }

  const page  = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;

  const { rows: txRows } = await pool.query(
    `SELECT id, courier_id, order_id, amount, type, notes, balance_after, reference_type, description, created_at
     FROM courier_wallet_transactions
     WHERE courier_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [courier.id, limit, offset],
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM courier_wallet_transactions WHERE courier_id = $1`,
    [courier.id],
  );
  const total = parseInt(countRows[0].count, 10);

  res.json({
    transactions: txRows.map((t) => ({
      id: t.id,
      orderId: t.order_id,
      amount: parseFloat(String(t.amount)),
      type: t.type,
      notes: t.notes,
      description: t.description ?? t.notes,
      balanceAfter: t.balance_after !== null ? parseFloat(String(t.balance_after)) : null,
      referenceType: t.reference_type,
      createdAt: t.created_at,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ─── POST /courier/payouts ────────────────────────────────────────────────────

router.post("/courier/payouts", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  const courier = await getCourierByUserId(req.user!.userId);
  if (!courier || courier.status !== "approved") { res.status(403).json({ error: "Access denied" }); return; }

  const amount = parseFloat(String(req.body?.amount ?? "0"));
  if (!amount || amount <= 0) { res.status(400).json({ error: "Amount must be greater than 0" }); return; }
  if (!Number.isFinite(amount)) { res.status(400).json({ error: "Invalid amount" }); return; }

  try {
    const payoutReq = await requestPayout(courier.id, amount);
    res.status(201).json({ ok: true, payout: payoutReq });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create payout request";
    const status = msg.includes("Insufficient") ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

// ─── GET /courier/payouts ─────────────────────────────────────────────────────

router.get("/courier/payouts", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  const courier = await getCourierByUserId(req.user!.userId);
  if (!courier || courier.status !== "approved") { res.status(403).json({ error: "Access denied" }); return; }

  const { rows } = await pool.query(
    `SELECT * FROM courier_payout_requests WHERE courier_id = $1 ORDER BY created_at DESC`,
    [courier.id],
  );

  res.json({
    payouts: rows.map((r) => ({
      id: r.id,
      amount: parseFloat(String(r.amount)),
      status: r.status,
      rejectionReason: r.rejection_reason,
      approvedAt: r.approved_at,
      paidAt: r.paid_at,
      createdAt: r.created_at,
    })),
  });
});

// ─── GET /admin/courier-payouts ───────────────────────────────────────────────

router.get("/admin/courier-payouts", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const status  = req.query.status as string | undefined;
  const search  = (req.query.search as string | undefined)?.trim() ?? "";
  const page    = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit   = 20;
  const offset  = (page - 1) * limit;

  let whereClause = "WHERE 1=1";
  const params: unknown[] = [];
  let idx = 1;

  if (status && ["PENDING", "APPROVED", "REJECTED", "PAID"].includes(status)) {
    whereClause += ` AND pr.status = $${idx++}`;
    params.push(status);
  }
  if (search) {
    whereClause += ` AND (u.name ILIKE $${idx++} OR u.email ILIKE $${idx++})`;
    params.push(`%${search}%`, `%${search}%`);
  }

  const countParams = [...params];
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM courier_payout_requests pr
     JOIN couriers c ON c.id = pr.courier_id
     JOIN users u ON u.id = c.user_id
     ${whereClause}`,
    countParams,
  );
  const total = parseInt(countRows[0].count, 10);

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT pr.*,
            u.name AS courier_name, u.email AS courier_email, u.phone AS courier_phone,
            au.name AS approved_by_name
     FROM courier_payout_requests pr
     JOIN couriers c ON c.id = pr.courier_id
     JOIN users u ON u.id = c.user_id
     LEFT JOIN users au ON au.id = pr.approved_by
     ${whereClause}
     ORDER BY pr.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params,
  );

  // Stats
  const { rows: statsRows } = await pool.query(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
     FROM courier_payout_requests GROUP BY status`,
  );
  const stats: Record<string, { count: number; total: number }> = {};
  for (const s of statsRows) {
    stats[s.status] = { count: parseInt(s.count, 10), total: parseFloat(String(s.total)) };
  }

  res.json({
    payouts: rows.map((r) => ({
      id: r.id,
      courierId: r.courier_id,
      courierName: r.courier_name,
      courierEmail: r.courier_email,
      courierPhone: r.courier_phone,
      amount: parseFloat(String(r.amount)),
      status: r.status,
      rejectionReason: r.rejection_reason,
      approvedBy: r.approved_by,
      approvedByName: r.approved_by_name,
      approvedAt: r.approved_at,
      paidAt: r.paid_at,
      createdAt: r.created_at,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    stats,
  });
});

// ─── POST /admin/courier-payouts/:id/approve ──────────────────────────────────

router.post("/admin/courier-payouts/:id/approve", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const payoutId = parseInt(String(req.params.id), 10);
  if (isNaN(payoutId)) { res.status(400).json({ error: "Invalid payout ID" }); return; }

  try {
    await approvePayout(payoutId, req.user!.userId);
    res.json({ ok: true, message: "Payout approved" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to approve payout";
    res.status(400).json({ error: msg });
  }
});

// ─── POST /admin/courier-payouts/:id/reject ───────────────────────────────────

router.post("/admin/courier-payouts/:id/reject", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const payoutId = parseInt(String(req.params.id), 10);
  if (isNaN(payoutId)) { res.status(400).json({ error: "Invalid payout ID" }); return; }

  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) { res.status(400).json({ error: "Rejection reason is required" }); return; }

  try {
    await rejectPayout(payoutId, req.user!.userId, reason);
    res.json({ ok: true, message: "Payout rejected" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reject payout";
    res.status(400).json({ error: msg });
  }
});

export default router;
