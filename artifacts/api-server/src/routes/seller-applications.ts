import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc, and, ne } from "drizzle-orm";
import { db, usersTable, sellerApplicationsTable } from "@workspace/db";
import { createNotification, bi, kickSseRole } from "../lib/notif";
import { requireAuth, requireRole, requireActiveAccount } from "../middlewares/auth";

const router: IRouter = Router();

const SellerApplicationBody = z.object({
  storeName: z.string().min(2, "Store name must be at least 2 characters").max(100),
  phone: z.string().min(5, "Valid phone number required").max(30),
  city: z.string().min(2, "City is required"),
  categories: z.array(z.string().min(1)).min(1, "At least one category is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  address: z.string().optional(),
  website: z.string().optional(),
  socialLinks: z.string().optional(),
  businessInfo: z.string().optional(),
  idImageUrl: z.string().optional(),
});

const DraftApplicationBody = z.object({
  storeName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  city: z.string().optional(),
  categories: z.array(z.string()).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  socialLinks: z.string().optional(),
  businessInfo: z.string().optional(),
  idImageUrl: z.string().optional(),
});

const selectApplicationFields = {
  id: sellerApplicationsTable.id,
  userId: sellerApplicationsTable.userId,
  storeName: sellerApplicationsTable.storeName,
  phone: sellerApplicationsTable.phone,
  city: sellerApplicationsTable.city,
  address: sellerApplicationsTable.address,
  category: sellerApplicationsTable.category,
  categories: sellerApplicationsTable.categories,
  description: sellerApplicationsTable.description,
  socialLinks: sellerApplicationsTable.socialLinks,
  website: sellerApplicationsTable.website,
  businessInfo: sellerApplicationsTable.businessInfo,
  idImageUrl: sellerApplicationsTable.idImageUrl,
  status: sellerApplicationsTable.status,
  adminNotes: sellerApplicationsTable.adminNotes,
  rejectionReason: sellerApplicationsTable.rejectionReason,
  reviewedAt: sellerApplicationsTable.reviewedAt,
  reviewedById: sellerApplicationsTable.reviewedById,
  createdAt: sellerApplicationsTable.createdAt,
  updatedAt: sellerApplicationsTable.updatedAt,
  userName: usersTable.name,
  userEmail: usersTable.email,
};

/** Helper: get the most recent application for a user */
async function getLatestApp(userId: number) {
  const [app] = await db
    .select()
    .from(sellerApplicationsTable)
    .where(eq(sellerApplicationsTable.userId, userId))
    .orderBy(desc(sellerApplicationsTable.createdAt))
    .limit(1);
  return app ?? null;
}

/* ── GET /seller-applications/my ──────────────────────────── */
router.get("/seller-applications/my", requireAuth, async (req, res): Promise<void> => {
  const app = await getLatestApp(req.user!.userId);
  res.json(app);
});

/* ── PATCH /seller-applications/draft ────────────────────────
   Create or update a draft. Zero side-effects on user role/sellerStatus.
   Allowed when: no app, existing draft, or existing rejected app. */
router.patch("/seller-applications/draft", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!existingUser) { res.status(404).json({ error: "User not found" }); return; }
  if (existingUser.role === "seller") {
    res.status(400).json({ error: "You are already an approved seller" });
    return;
  }

  const parsed = DraftApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const existing = await getLatestApp(userId);

  if (existing && existing.status !== "draft" && existing.status !== "rejected") {
    res.status(400).json({ error: "Cannot save draft: you already have an active application" });
    return;
  }

  const { categories, ...rest } = parsed.data;

  if (existing?.status === "draft") {
    // Patch only provided fields into the existing draft
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (rest.storeName  !== undefined) patch.storeName  = rest.storeName;
    if (rest.phone      !== undefined) patch.phone      = rest.phone;
    if (rest.city       !== undefined) patch.city       = rest.city;
    if (rest.description !== undefined) patch.description = rest.description;
    if (rest.address    !== undefined) patch.address    = rest.address;
    if (rest.website    !== undefined) patch.website    = rest.website;
    if (rest.socialLinks !== undefined) patch.socialLinks = rest.socialLinks;
    if (rest.businessInfo !== undefined) patch.businessInfo = rest.businessInfo;
    if (rest.idImageUrl  !== undefined) patch.idImageUrl  = rest.idImageUrl;
    if (categories !== undefined) {
      patch.categories = categories;
      patch.category   = categories[0] ?? "";
    }

    const [updated] = await db
      .update(sellerApplicationsTable)
      .set(patch as Parameters<typeof db.update>[0] extends infer T ? any : any)
      .where(eq(sellerApplicationsTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  // Delete the old rejected app before creating a fresh draft
  if (existing?.status === "rejected") {
    await db.delete(sellerApplicationsTable).where(eq(sellerApplicationsTable.id, existing.id));
  }

  // Create new draft — required DB columns use empty-string defaults
  const [draft] = await db
    .insert(sellerApplicationsTable)
    .values({
      userId,
      status: "draft",
      storeName:   rest.storeName   ?? "",
      phone:       rest.phone       ?? "",
      city:        rest.city        ?? "",
      category:    categories?.[0]  ?? "",
      categories:  categories       ?? [],
      description: rest.description ?? "",
      address:     rest.address,
      website:     rest.website,
      socialLinks: rest.socialLinks,
      businessInfo: rest.businessInfo,
      idImageUrl:  rest.idImageUrl,
    })
    .returning();
  res.status(201).json(draft);
});

/* ── DELETE /seller-applications/my ──────────────────────────
   Withdraw a draft or pending application. Resets user.sellerStatus. */
router.delete("/seller-applications/my", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const app = await getLatestApp(userId);

  if (!app) { res.status(404).json({ error: "No application found" }); return; }

  if (app.status === "approved") {
    res.status(400).json({ error: "Cannot withdraw an approved application" });
    return;
  }
  if (app.status === "under_review") {
    res.status(400).json({ error: "Cannot withdraw an application that is under review. Please contact support." });
    return;
  }

  await db.delete(sellerApplicationsTable).where(eq(sellerApplicationsTable.id, app.id));
  await db.update(usersTable).set({ sellerStatus: null }).where(eq(usersTable.id, userId));

  res.json({ message: "Application withdrawn successfully" });
});

/* ── POST /seller-applications ────────────────────────────────
   Final submission. Transitions draft→pending or creates fresh pending. */
router.post("/seller-applications", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!existingUser) { res.status(404).json({ error: "User not found" }); return; }
  if (existingUser.role === "seller") {
    res.status(400).json({ error: "You are already an approved seller" });
    return;
  }

  const existing = await getLatestApp(userId);

  if (existing) {
    if (existing.status === "pending" || existing.status === "under_review") {
      res.status(400).json({ error: "You already have a pending or active application" });
      return;
    }
    if (existing.status === "approved") {
      res.status(400).json({ error: "You are already an approved seller" });
      return;
    }
    // "draft" and "rejected" fall through to allow submission
    if (existing.status === "rejected") {
      await db.delete(sellerApplicationsTable).where(eq(sellerApplicationsTable.id, existing.id));
    }
  }

  const parsed = SellerApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { categories, ...restData } = parsed.data;

  let application;

  if (existing?.status === "draft") {
    // Transition: draft → pending (update in-place)
    const [updated] = await db
      .update(sellerApplicationsTable)
      .set({
        ...restData,
        category: categories[0],
        categories,
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(sellerApplicationsTable.id, existing.id))
      .returning();
    application = updated;
  } else {
    // Fresh submission (no prior app or rejected app already deleted)
    const [inserted] = await db
      .insert(sellerApplicationsTable)
      .values({
        userId,
        ...restData,
        category: categories[0],
        categories,
      })
      .returning();
    application = inserted;
  }

  // Mark user as having a pending application
  await db.update(usersTable).set({ sellerStatus: "pending" }).where(eq(usersTable.id, userId));

  // Notify admins
  const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "seller_applied",
      title: bi("New Seller Application", "طلب بائع جديد"),
      body: bi(
        `${existingUser.name} has applied to become a seller (store: ${parsed.data.storeName}). Review their application.`,
        `${existingUser.name} قدّم طلبًا ليصبح بائعًا (المتجر: ${parsed.data.storeName}). راجع الطلب.`
      ),
      priority: "important",
      link: `/admin/sellers`,
    });
  }

  await createNotification({
    userId,
    type: "seller_applied",
    title: bi("Application Submitted!", "تم تقديم الطلب!"),
    body: bi(
      `Your seller application for "${parsed.data.storeName}" has been submitted successfully. We'll review it and get back to you soon.`,
      `تم تقديم طلب بيعك لـ "${parsed.data.storeName}" بنجاح. سنراجعه ونتواصل معك قريبًا.`
    ),
    priority: "normal",
    link: `/seller/application-status`,
  });

  res.status(201).json(application);
});

/* ── GET /seller-applications (admin) ────────────────────────── */
router.get("/seller-applications", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const statusFilter = req.query.status as string | undefined;

  let applications;
  if (statusFilter && statusFilter !== "all") {
    applications = await db
      .select(selectApplicationFields)
      .from(sellerApplicationsTable)
      .leftJoin(usersTable, eq(sellerApplicationsTable.userId, usersTable.id))
      .where(eq(sellerApplicationsTable.status, statusFilter))
      .orderBy(desc(sellerApplicationsTable.createdAt));
  } else {
    applications = await db
      .select(selectApplicationFields)
      .from(sellerApplicationsTable)
      .leftJoin(usersTable, eq(sellerApplicationsTable.userId, usersTable.id))
      .orderBy(desc(sellerApplicationsTable.createdAt));
  }

  res.json(applications);
});

/* ── PATCH /seller-applications/:id/status (admin) ───────────── */
router.patch("/seller-applications/:id/status", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const appId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(appId)) { res.status(400).json({ error: "Invalid application ID" }); return; }

  const { status, adminNotes, rejectionReason } = req.body;

  const validStatuses = ["draft", "pending", "under_review", "approved", "rejected", "suspended"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }

  const [application] = await db
    .select()
    .from(sellerApplicationsTable)
    .where(eq(sellerApplicationsTable.id, appId));

  if (!application) { res.status(404).json({ error: "Application not found" }); return; }

  const [updated] = await db
    .update(sellerApplicationsTable)
    .set({
      status,
      adminNotes: adminNotes ?? null,
      rejectionReason: (status === "rejected" || status === "suspended") ? (rejectionReason ?? null) : null,
      reviewedAt: new Date(),
      reviewedById: req.user!.userId,
      updatedAt: new Date(),
    })
    .where(eq(sellerApplicationsTable.id, appId))
    .returning();

  if (status === "approved") {
    // Generate a unique SEO-friendly store slug from the store name
    const rawSlug = (application.storeName || `store-${application.userId}`)
      .toLowerCase().trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 55) || `store-${application.userId}`;

    let slug = rawSlug;
    let suffix = 2;
    while (true) {
      const [conflict] = await db
        .select({ id: sellerApplicationsTable.id })
        .from(sellerApplicationsTable)
        .where(and(eq(sellerApplicationsTable.storeSlug, slug), ne(sellerApplicationsTable.id, appId)))
        .limit(1);
      if (!conflict) break;
      slug = `${rawSlug}-${suffix++}`;
    }

    await db
      .update(sellerApplicationsTable)
      .set({ storeSlug: slug, updatedAt: new Date() })
      .where(eq(sellerApplicationsTable.id, appId));

    await db
      .update(usersTable)
      .set({ role: "seller", sellerStatus: "approved", trustLevel: "new" })
      .where(eq(usersTable.id, application.userId));

    await createNotification({
      userId: application.userId,
      type: "seller_approved",
      title: bi("🎉 Seller Application Approved!", "🎉 تمت الموافقة على طلبك!"),
      body: bi(
        `Congratulations! Your application for "${application.storeName}" has been approved. You can now start listing products and selling on Syano.`,
        `مبارك! تمت الموافقة على طلبك لـ "${application.storeName}". يمكنك الآن البدء في إدراج المنتجات والبيع على سيانو.`
      ),
      priority: "critical",
      link: `/seller/application-status`,
    });
  } else if (status === "rejected") {
    await db.update(usersTable).set({ role: "customer", sellerStatus: "rejected" }).where(eq(usersTable.id, application.userId));
    kickSseRole(application.userId);

    await createNotification({
      userId: application.userId,
      type: "seller_rejected",
      title: bi("Seller Application Not Approved", "لم تتم الموافقة على الطلب"),
      body: rejectionReason
        ? bi(`Your seller application was not approved. Reason: ${rejectionReason}`, `لم تتم الموافقة على طلبك. السبب: ${rejectionReason}`)
        : bi(`Your seller application was not approved at this time. You may apply again after addressing the feedback.`, `لم تتم الموافقة على طلبك في هذا الوقت. يمكنك التقديم مجددًا بعد معالجة الملاحظات.`),
      priority: "important",
      link: `/seller/application-status`,
    });
  } else if (status === "under_review") {
    await db.update(usersTable).set({ sellerStatus: "under_review" }).where(eq(usersTable.id, application.userId));

    await createNotification({
      userId: application.userId,
      type: "seller_applied",
      title: bi("Application Under Review", "طلبك قيد المراجعة"),
      body: bi(`Your seller application is being actively reviewed by our team. We'll notify you once a decision is made.`, `يقوم فريقنا حاليًا بمراجعة طلبك. سنُخطرك فور اتخاذ القرار.`),
      priority: "normal",
      link: `/seller/application-status`,
    });
  } else if (status === "suspended") {
    await db.update(usersTable).set({ sellerStatus: "suspended" }).where(eq(usersTable.id, application.userId));

    await createNotification({
      userId: application.userId,
      type: "seller_rejected",
      title: bi("Account Suspended", "تم تعليق الحساب"),
      body: rejectionReason
        ? bi(`Your seller account has been suspended. Reason: ${rejectionReason}`, `تم تعليق حسابك كبائع. السبب: ${rejectionReason}`)
        : bi(`Your seller account has been suspended. Please contact support for more information.`, `تم تعليق حسابك كبائع. يرجى التواصل مع الدعم للمزيد من المعلومات.`),
      priority: "critical",
      link: `/seller/application-status`,
    });
  } else {
    await db.update(usersTable).set({ sellerStatus: status }).where(eq(usersTable.id, application.userId));
  }

  res.json(updated);
});

export default router;
