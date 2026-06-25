/**
 * Seed script: creates (or updates) the canonical admin account.
 * Run with: pnpm --filter @workspace/scripts run seed:admin
 *
 * Idempotent — safe to run multiple times.
 * - If the target email already exists → update password/role/status in place.
 * - All legacy admin emails are removed on every run.
 * - On a completely fresh DB → inserts the admin account.
 */

import { db, usersTable } from "@workspace/db";
import { eq, inArray, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL    = "delewatiamer7@gmail.com";
const ADMIN_PASSWORD = "00Amer00";
const ADMIN_NAME     = "Admin";

// All legacy/test admin emails that must be purged on every seed run
const LEGACY_EMAILS  = ["admin@marketplace.com", "admin@syano.online"];

async function main() {
  console.log("Seeding admin account…");

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // 1. Remove every legacy admin account (different email, role=admin)
  for (const legacy of LEGACY_EMAILS) {
    const deleted = await db
      .delete(usersTable)
      .where(eq(usersTable.email, legacy))
      .returning({ id: usersTable.id });
    if (deleted.length) {
      console.log(`  Removed legacy account: ${legacy} (id=${deleted[0].id})`);
    }
  }

  // 2. Upsert the canonical admin account
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing) {
    await db
      .update(usersTable)
      .set({
        passwordHash:   hash,
        role:           "admin",
        name:           ADMIN_NAME,
        accountStatus:  "active",
        isVerified:     true,
        suspendedReason: null,
        suspendedBy:    null,
        suspendedAt:    null,
      })
      .where(eq(usersTable.email, ADMIN_EMAIL));
    console.log(`  Updated existing account: ${ADMIN_EMAIL}`);
  } else {
    await db.insert(usersTable).values({
      email:          ADMIN_EMAIL,
      passwordHash:   hash,
      name:           ADMIN_NAME,
      role:           "admin",
      accountStatus:  "active",
      isVerified:     true,
      otpRequestCount: 0,
      otpRequestWindowStart: new Date(),
    });
    console.log(`  Created new account: ${ADMIN_EMAIL}`);
  }

  // 3. Remove any other rogue admin accounts that aren't the canonical one
  const otherAdminEmails = (await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.role, "admin")))
    .map(r => r.email)
    .filter((e): e is string => e !== null && e !== ADMIN_EMAIL);

  const rogueAdmins = otherAdminEmails.length > 0
    ? await db
        .delete(usersTable)
        .where(inArray(usersTable.email, otherAdminEmails))
        .returning({ id: usersTable.id, email: usersTable.email })
    : [];
  for (const r of rogueAdmins) {
    console.log(`  Removed rogue admin: ${r.email} (id=${r.id})`);
  }

  // 4. Final verification
  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, accountStatus: usersTable.accountStatus, isVerified: usersTable.isVerified })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  const adminCount = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));

  console.log(`\n✓ Admin account ready:`);
  console.log(`  id:            ${user.id}`);
  console.log(`  email:         ${user.email}`);
  console.log(`  role:          ${user.role}`);
  console.log(`  accountStatus: ${user.accountStatus}`);
  console.log(`  isVerified:    ${user.isVerified}`);
  console.log(`  total admins:  ${adminCount.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
