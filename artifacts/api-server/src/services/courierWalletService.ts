/**
 * Courier Wallet Service — Phase A9
 *
 * Handles all financial operations for couriers:
 *   - Auto-credit earnings on delivery
 *   - Payout requests (create / approve / reject)
 *   - Wallet balance reads
 *
 * Every mutating operation runs inside a DB transaction.
 * courier_wallet_transactions is the immutable ledger.
 * courier_wallets holds the materialized balance cache.
 */

import { pool } from "@workspace/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletData {
  id: number;
  courierId: number;
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  lifetimePayouts: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutRequest {
  id: number;
  courierId: number;
  amount: number;
  status: string;
  rejectionReason: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function n(v: unknown): number {
  return parseFloat(String(v ?? "0"));
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get or create a wallet for a courier.
 * Uses INSERT … ON CONFLICT so it's safe to call concurrently.
 */
export async function getOrCreateWallet(courierId: number): Promise<WalletData> {
  const { rows } = await pool.query(
    `INSERT INTO courier_wallets (courier_id)
     VALUES ($1)
     ON CONFLICT (courier_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [courierId],
  );
  const r = rows[0];
  return {
    id: r.id,
    courierId: r.courier_id,
    availableBalance: n(r.available_balance),
    pendingBalance: n(r.pending_balance),
    lifetimeEarnings: n(r.lifetime_earnings),
    lifetimePayouts: n(r.lifetime_payouts),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Add an earning to the courier wallet (called on DELIVERED).
 * Creates a wallet transaction and updates balances.
 */
export async function addEarning(
  courierId: number,
  amount: number,
  orderId?: number,
  description?: string,
): Promise<void> {
  if (amount <= 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Upsert wallet
    const walletRes = await client.query(
      `INSERT INTO courier_wallets (courier_id)
       VALUES ($1)
       ON CONFLICT (courier_id) DO UPDATE SET updated_at = NOW()
       RETURNING available_balance`,
      [courierId],
    );
    const balanceBefore = n(walletRes.rows[0].available_balance);
    const balanceAfter  = parseFloat((balanceBefore + amount).toFixed(2));

    // Insert immutable transaction record
    await client.query(
      `INSERT INTO courier_wallet_transactions
         (courier_id, order_id, amount, type, notes, balance_after, reference_type)
       VALUES ($1, $2, $3, 'EARNING', $4, $5, 'order')`,
      [
        courierId,
        orderId ?? null,
        amount.toFixed(2),
        description ?? `Delivery earning for order #${orderId ?? "?"}`,
        balanceAfter,
      ],
    );

    // Update materialized wallet balances
    await client.query(
      `UPDATE courier_wallets
       SET available_balance = available_balance + $1,
           lifetime_earnings = lifetime_earnings + $1,
           updated_at = NOW()
       WHERE courier_id = $2`,
      [amount.toFixed(2), courierId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Request a payout.
 * Moves `amount` from available → pending and creates a payout_request row.
 */
export async function requestPayout(courierId: number, amount: number): Promise<PayoutRequest> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const walletRes = await client.query(
      `SELECT available_balance FROM courier_wallets WHERE courier_id = $1`,
      [courierId],
    );
    if (!walletRes.rows.length) throw new Error("Wallet not found — complete a delivery first");
    const available = n(walletRes.rows[0].available_balance);
    if (amount > available) throw new Error("Insufficient balance");

    const balanceAfter = parseFloat((available - amount).toFixed(2));

    // Create payout request
    const reqRes = await client.query(
      `INSERT INTO courier_payout_requests (courier_id, amount, status)
       VALUES ($1, $2, 'PENDING') RETURNING *`,
      [courierId, amount.toFixed(2)],
    );
    const req = reqRes.rows[0];

    // Transaction record (negative = money leaving available)
    await client.query(
      `INSERT INTO courier_wallet_transactions
         (courier_id, amount, type, notes, balance_after, reference_type)
       VALUES ($1, $2, 'PAYOUT_REQUEST', $3, $4, 'payout')`,
      [courierId, (-amount).toFixed(2), `Payout request #${req.id}`, balanceAfter],
    );

    // Move available → pending
    await client.query(
      `UPDATE courier_wallets
       SET available_balance = available_balance - $1,
           pending_balance   = pending_balance   + $1,
           updated_at = NOW()
       WHERE courier_id = $2`,
      [amount.toFixed(2), courierId],
    );

    await client.query("COMMIT");
    return {
      id: req.id, courierId: req.courier_id, amount: n(req.amount),
      status: req.status, rejectionReason: null,
      approvedBy: null, approvedAt: null, paidAt: null,
      createdAt: req.created_at,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin approves a payout request.
 * Moves amount from pending → lifetime_payouts.
 */
export async function approvePayout(payoutId: number, adminId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const reqRes = await client.query(
      `UPDATE courier_payout_requests
       SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'PENDING'
       RETURNING *`,
      [adminId, payoutId],
    );
    if (!reqRes.rows.length) throw new Error("Payout not found or not PENDING");
    const req = reqRes.rows[0];
    const amount = n(req.amount);
    const courierId = req.courier_id as number;

    const walletRes = await client.query(
      `SELECT pending_balance FROM courier_wallets WHERE courier_id = $1`,
      [courierId],
    );
    const balanceAfter = parseFloat((n(walletRes.rows[0]?.pending_balance) - amount).toFixed(2));

    await client.query(
      `INSERT INTO courier_wallet_transactions
         (courier_id, amount, type, notes, balance_after, reference_type)
       VALUES ($1, $2, 'PAYOUT_APPROVED', $3, $4, 'payout')`,
      [courierId, (-amount).toFixed(2), `Payout #${payoutId} approved by admin`, balanceAfter],
    );

    await client.query(
      `UPDATE courier_wallets
       SET pending_balance   = pending_balance - $1,
           lifetime_payouts  = lifetime_payouts + $1,
           updated_at = NOW()
       WHERE courier_id = $2`,
      [amount.toFixed(2), courierId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin rejects a payout request.
 * Refunds amount from pending → available.
 */
export async function rejectPayout(payoutId: number, adminId: number, reason: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const reqRes = await client.query(
      `UPDATE courier_payout_requests
       SET status = 'REJECTED', approved_by = $1, approved_at = NOW(), rejection_reason = $2
       WHERE id = $3 AND status = 'PENDING'
       RETURNING *`,
      [adminId, reason, payoutId],
    );
    if (!reqRes.rows.length) throw new Error("Payout not found or not PENDING");
    const req = reqRes.rows[0];
    const amount = n(req.amount);
    const courierId = req.courier_id as number;

    const walletRes = await client.query(
      `SELECT available_balance FROM courier_wallets WHERE courier_id = $1`,
      [courierId],
    );
    const balanceAfter = parseFloat((n(walletRes.rows[0]?.available_balance) + amount).toFixed(2));

    await client.query(
      `INSERT INTO courier_wallet_transactions
         (courier_id, amount, type, notes, balance_after, reference_type)
       VALUES ($1, $2, 'PAYOUT_REJECTED', $3, $4, 'payout')`,
      [courierId, amount.toFixed(2), `Payout #${payoutId} rejected: ${reason}`, balanceAfter],
    );

    // Refund: pending → available
    await client.query(
      `UPDATE courier_wallets
       SET pending_balance   = pending_balance   - $1,
           available_balance = available_balance + $1,
           updated_at = NOW()
       WHERE courier_id = $2`,
      [amount.toFixed(2), courierId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
