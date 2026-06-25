import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, sellerApplicationsTable, couriersTable } from "@workspace/db";
import { logger } from "./logger";

// ─── AI Support Agent bootstrap ───────────────────────────────────────────────

/**
 * Ensures the "Smart Support" AI agent system user exists.
 * This user sends messages on behalf of the AI in ai_support conversations.
 * It uses a random password hash (never used for login).
 */
export async function bootstrapAISupportAgent(): Promise<void> {
  const email = "ai-support@syano.internal";
  try {
    const [existing] = await db
      .select({ id: usersTable.id, name: usersTable.name, accountStatus: usersTable.accountStatus })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!existing) {
      const randomHash = await bcrypt.hash(Math.random().toString(36) + Date.now(), 12);
      await db
        .insert(usersTable)
        .values({
          email,
          phone: null,
          passwordHash: randomHash,
          name: "الدعم الذكي",
          role: "admin",
          isVerified: true,
          accountStatus: "active",
        } as any);
      logger.info({ email }, "AI Support Agent bootstrapped (created)");
    } else {
      // Ensure it stays active
      if (existing.accountStatus !== "active") {
        await db
          .update(usersTable)
          .set({ accountStatus: "active" } as any)
          .where(eq(usersTable.email, email));
        logger.info({ email }, "AI Support Agent repaired → active");
      } else {
        logger.info({ email, id: existing.id }, "AI Support Agent healthy");
      }
    }
  } catch (err) {
    logger.error({ email, err }, "Failed to bootstrap AI Support Agent");
  }
}

// ─── PERMANENT TEST ACCOUNTS ─────────────────────────────────────────────────
// These accounts must ALWAYS exist for development, QA, and recovery testing.
// They are auto-created and self-healing, exactly like bootstrapRootAdmin().
// Passwords default to 00Amer00 unless overridden by env vars.

interface TestAccountSpec {
  email: string;
  name: string;
  role: "seller" | "courier" | "customer" | "admin";
  phone: string | null;
  envPasswordVar: string;
  defaultPassword: string;
}

const TEST_ACCOUNTS: TestAccountSpec[] = [
  {
    email: "delewatiamer8@gmail.com",
    name: "Test Seller",
    role: "seller",
    phone: null,
    envPasswordVar: "TEST_SELLER_PASSWORD",
    defaultPassword: "00Amer00",
  },
  {
    email: "delewatiamer9@gmail.com",
    name: "Test Courier",
    role: "courier",
    phone: null,
    envPasswordVar: "TEST_COURIER_PASSWORD",
    defaultPassword: "00Amer00",
  },
];

/**
 * Ensures all permanent test accounts exist and are healthy.
 * Runs on every server startup. Idempotent and safe to re-run.
 *
 * For each account guarantees:
 *   - email matches spec
 *   - role matches spec
 *   - account_status = active
 *   - is_verified = true
 *   - password matches env var (default: 00Amer00)
 *
 * Additionally:
 *   - delewatiamer8 (seller) → seller_application with status=approved + storeSlug
 *   - delewatiamer9 (courier) → couriers profile with status=approved + active=true
 *
 * Never creates duplicates. Never overwrites a valid password.
 * Survives schema restores and migration runs.
 */
export async function bootstrapTestAccounts(): Promise<void> {
  for (const spec of TEST_ACCOUNTS) {
    const password = process.env[spec.envPasswordVar] ?? spec.defaultPassword;

    try {
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, spec.email))
        .limit(1);

      let userId: number;

      if (!existing) {
        // Account missing — create it
        const passwordHash = await bcrypt.hash(password, 12);
        const [created] = await db
          .insert(usersTable)
          .values({
            email: spec.email,
            phone: spec.phone,
            passwordHash,
            name: spec.name,
            role: spec.role,
            isVerified: true,
            accountStatus: "active",
          } as any)
          .returning({ id: usersTable.id });
        userId = created.id;
        logger.info(
          { email: spec.email, role: spec.role },
          `Test account bootstrapped (created): ${spec.name}`
        );
      } else {
        userId = existing.id;
        // Account exists — repair any drift
        const patch: Partial<typeof usersTable.$inferInsert> = {};
        const repairs: string[] = [];

        if (existing.role !== spec.role) {
          patch.role = spec.role;
          repairs.push(`role→${spec.role}`);
        }
        if (existing.accountStatus !== "active") {
          patch.accountStatus = "active";
          repairs.push("accountStatus→active");
        }
        if (!existing.isVerified) {
          patch.isVerified = true;
          repairs.push("isVerified→true");
        }

        // Only reset password if it is empty/invalid
        const hashValid =
          existing.passwordHash.length > 0 &&
          (await bcrypt.compare(password, existing.passwordHash));
        if (!hashValid) {
          patch.passwordHash = await bcrypt.hash(password, 12);
          repairs.push("passwordHash regenerated");
        }

        if (Object.keys(patch).length > 0) {
          await db
            .update(usersTable)
            .set(patch)
            .where(eq(usersTable.email, spec.email));
          logger.info(
            { email: spec.email, repairs },
            `Test account repaired: ${spec.name}`
          );
        } else {
          logger.info(
            { email: spec.email },
            `Test account healthy: ${spec.name}`
          );
        }
      }

      // ── Role-specific profile bootstrap ───────────────────────────────────
      if (spec.role === "seller") {
        await bootstrapSellerApplication(userId, spec.name);
      } else if (spec.role === "courier") {
        await bootstrapCourierProfile(userId, spec.name);
      }
    } catch (err) {
      // Non-fatal — log and continue so other accounts still bootstrap
      logger.error(
        { email: spec.email, err },
        `Failed to bootstrap test account: ${spec.name}`
      );
    }
  }
}

/**
 * Ensures the permanent test seller has an approved seller_application.
 * Without this record, seller_applications/my returns null and the seller
 * dashboard shows no store data.
 */
async function bootstrapSellerApplication(userId: number, name: string): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: sellerApplicationsTable.id, status: sellerApplicationsTable.status })
      .from(sellerApplicationsTable)
      .where(eq(sellerApplicationsTable.userId, userId))
      .limit(1);

    if (!existing) {
      await db.insert(sellerApplicationsTable).values({
        userId,
        storeName: "Syano Test Store",
        storeNameAr: "متجر سيانو التجريبي",
        phone: "+963900000008",
        contactPhone: "+963900000008",
        city: "Aleppo",
        address: "Aleppo City Center",
        category: "Electronics",
        categories: ["Electronics", "Phones & Tablets"],
        description: "Official permanent test seller account for SYANO platform QA and recovery testing.",
        descriptionAr: "حساب البائع التجريبي الدائم لمنصة سيانو.",
        storeSlug: "syano-test-store",
        status: "approved",
        reviewedAt: new Date(),
      } as any);
      logger.info({ userId, name }, "Seller application bootstrapped (created): approved");
    } else if (existing.status !== "approved") {
      await db
        .update(sellerApplicationsTable)
        .set({ status: "approved", storeSlug: "syano-test-store", reviewedAt: new Date() } as any)
        .where(eq(sellerApplicationsTable.userId, userId));
      logger.info({ userId, name }, "Seller application bootstrapped (repaired to approved)");
    } else {
      logger.info({ userId, name }, "Seller application healthy: approved");
    }
  } catch (err) {
    logger.error({ userId, err }, "Failed to bootstrap seller application");
  }
}

/**
 * Ensures the permanent test courier has an approved couriers profile.
 * Without this record, /couriers/profile returns 404 and the courier
 * dashboard is completely non-functional.
 */
async function bootstrapCourierProfile(userId: number, name: string): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: couriersTable.id, status: couriersTable.status, active: couriersTable.active })
      .from(couriersTable)
      .where(eq(couriersTable.userId, userId))
      .limit(1);

    if (!existing) {
      await db.insert(couriersTable).values({
        userId,
        status: "approved",
        active: true,
        city: "Aleppo",
        district: "Aleppo Center",
        phone: "+963900000009",
        vehicleType: "motorcycle",
        completedDeliveries: 0,
        notes: "Permanent test courier account for SYANO platform QA.",
      } as any);
      logger.info({ userId, name }, "Courier profile bootstrapped (created): approved");
    } else {
      const patch: Record<string, unknown> = {};
      if (existing.status !== "approved") patch.status = "approved";
      if (!existing.active) patch.active = true;
      if (Object.keys(patch).length > 0) {
        await db
          .update(couriersTable)
          .set(patch as any)
          .where(eq(couriersTable.userId, userId));
        logger.info({ userId, name }, "Courier profile bootstrapped (repaired)");
      } else {
        logger.info({ userId, name }, "Courier profile healthy: approved + active");
      }
    }
  } catch (err) {
    logger.error({ userId, err }, "Failed to bootstrap courier profile");
  }
}
