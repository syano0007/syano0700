import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger";

// ─── PERMANENT ROOT OWNER ────────────────────────────────────────────────────
// This is the one and only root owner of the SYANO platform.
// This account MUST always exist, always be admin/active/verified.
// It is recreated/repaired automatically on every server startup.
// DO NOT change this email. DO NOT create any other bootstrap admin.
export const ROOT_OWNER_EMAIL = "delewatiamer7@gmail.com";

// Legacy typo variant that may exist in some databases after migration.
// If found, it is cleaned up and replaced with the correct account.
const LEGACY_TYPO_EMAIL = "delewaitamer7@gmail.com";

function getRootOwnerPassword(): string {
  return process.env.ROOT_ADMIN_PASSWORD ?? "00Amer00";
}

/**
 * Ensures the permanent Root Owner account exists and is healthy.
 * Runs on every server startup. Idempotent and safe to re-run.
 *
 * Guarantees:
 *   - email = delewatiamer7@gmail.com
 *   - role = admin
 *   - account_status = active
 *   - is_verified = true
 *   - password matches ROOT_ADMIN_PASSWORD env var (default: 00Amer00)
 *
 * Also cleans up any legacy typo-email bootstrap admin that may exist
 * from earlier recovery sessions.
 */
export async function bootstrapRootAdmin(): Promise<void> {
  const rootPassword = getRootOwnerPassword();

  // ── Step 1: Clean up legacy typo account if it exists ─────────────────────
  const [legacyRows] = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.email, LEGACY_TYPO_EMAIL))
    .limit(1);

  if (legacyRows) {
    // Only remove the legacy account if the correct one already exists or
    // we are about to create it — never leave the platform with zero admins.
    // We'll handle this after ensuring the correct account exists (Step 2).
    logger.info(
      { legacyEmail: LEGACY_TYPO_EMAIL },
      "Legacy typo bootstrap admin found — will clean up after ensuring correct account"
    );
  }

  // ── Step 2: Ensure correct Root Owner account exists ──────────────────────
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, ROOT_OWNER_EMAIL))
    .limit(1);

  if (!existing) {
    const passwordHash = await bcrypt.hash(rootPassword, 12);
    await db.insert(usersTable).values({
      email: ROOT_OWNER_EMAIL,
      phone: null,
      passwordHash,
      name: "Root Owner",
      role: "admin",
      isVerified: true,
      accountStatus: "active",
    } as any);
    logger.info({ email: ROOT_OWNER_EMAIL }, "Root Owner bootstrapped (created)");
  } else {
    // ── Step 3: Repair any drift on the existing account ──────────────────
    const patch: Partial<typeof usersTable.$inferInsert> = {};
    const repairs: string[] = [];

    if (existing.role !== "admin") {
      patch.role = "admin";
      repairs.push("role→admin");
    }
    if (existing.accountStatus !== "active") {
      patch.accountStatus = "active";
      repairs.push("accountStatus→active");
    }
    if (!existing.isVerified) {
      patch.isVerified = true;
      repairs.push("isVerified→true");
    }

    const hashValid =
      existing.passwordHash.length > 0 &&
      (await bcrypt.compare(rootPassword, existing.passwordHash));
    if (!hashValid) {
      patch.passwordHash = await bcrypt.hash(rootPassword, 12);
      repairs.push("passwordHash regenerated");
    }

    if (Object.keys(patch).length > 0) {
      await db
        .update(usersTable)
        .set(patch)
        .where(eq(usersTable.email, ROOT_OWNER_EMAIL));
      logger.info({ email: ROOT_OWNER_EMAIL, repairs }, "Root Owner repaired");
    } else {
      logger.info({ email: ROOT_OWNER_EMAIL }, "Root Owner healthy");
    }
  }

  // ── Step 4: Now safe to remove legacy typo account ────────────────────────
  if (legacyRows) {
    try {
      await db
        .delete(usersTable)
        .where(eq(usersTable.email, LEGACY_TYPO_EMAIL));
      logger.info(
        { legacyEmail: LEGACY_TYPO_EMAIL },
        "Legacy typo bootstrap admin removed"
      );
    } catch (err) {
      // Non-fatal — log and continue. The correct account already exists.
      logger.warn(
        { legacyEmail: LEGACY_TYPO_EMAIL, err },
        "Could not remove legacy typo bootstrap admin (may have FK references)"
      );
    }
  }
}
