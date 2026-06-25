// @ts-nocheck — Express v5 param types handled via String() casts
import { Router, type IRouter } from "express";
import { eq, and, desc, sql, or, ne, inArray, ilike, isNull } from "drizzle-orm";
import {
  db,
  usersTable,
  conversationsTable,
  messagesTable,
  productsTable,
  messageAttachmentsTable,
} from "@workspace/db";
import { requireAuth, requireActiveAccount } from "../middlewares/auth";
import { createNotification, bi } from "../lib/notif";

const router: IRouter = Router();

/* ── In-memory typing indicator store ───────────────────────── */
interface TypingUser { name: string; expiresAt: number }
const typingStore = new Map<number, Map<number, TypingUser>>();

function setTyping(convId: number, userId: number, name: string): void {
  if (!typingStore.has(convId)) typingStore.set(convId, new Map());
  typingStore.get(convId)!.set(userId, { name, expiresAt: Date.now() + 4000 });
}

function getTyping(convId: number, excludeUserId: number): TypingUser[] {
  const map = typingStore.get(convId);
  if (!map) return [];
  const now = Date.now();
  const result: TypingUser[] = [];
  for (const [uid, info] of map.entries()) {
    if (uid !== excludeUserId && info.expiresAt > now) result.push(info);
    else if (info.expiresAt <= now) map.delete(uid);
  }
  return result;
}

/* ── Helper: verify conversation access ─────────────────────── */
async function getConvWithAccess(convId: number, userId: number, role: string) {
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!conv) return null;
  const isParticipant = conv.customerId === userId || conv.sellerId === userId;
  if (!isParticipant && role !== "admin") return null;
  return conv;
}

/* ── GET /conversations/unread-count ─────────────────────────
   Global unread badge count for navbar */
router.get("/conversations/unread-count", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const result = await db.execute<{ count: number }>(
      sql`SELECT cast(count(*) as int) AS count
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          WHERE m.read_at IS NULL
            AND m.deleted_at IS NULL
            AND m.sender_id != ${userId}
            AND (c.customer_id = ${userId} OR c.seller_id = ${userId})
            AND c.status NOT IN ('archived','blocked')`
    );
    res.json({ unread: Number((result.rows as any[])[0]?.count ?? 0) });
  } catch {
    res.json({ unread: 0 });
  }
});

/* ── GET /conversations/search?q= ────────────────────────────
   Search conversations by partner name or message content */
router.get("/conversations/search", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const q = String(req.query.q ?? "").trim();

  if (!q || q.length < 2) { res.json([]); return; }

  const whereClause = role === "seller"
    ? eq(conversationsTable.sellerId, userId)
    : role === "admin"
    ? sql`1=1`
    : eq(conversationsTable.customerId, userId);

  const convs = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(and(
      whereClause,
      sql`${conversationsTable.status} != 'blocked'`
    ))
    .limit(200);

  if (!convs.length) { res.json([]); return; }

  const ids = convs.map(c => c.id);
  const idList = sql.join(ids.map(id => sql`${id}`), sql`, `);

  const matching = await db.execute<{ conv_id: number }>(
    sql`SELECT DISTINCT m.conversation_id AS conv_id
        FROM messages m
        WHERE m.conversation_id IN (${idList})
          AND m.deleted_at IS NULL
          AND m.body ILIKE ${"%" + q + "%"}
        LIMIT 30`
  );

  const matchingIds = new Set((matching.rows as any[]).map(r => Number(r.conv_id)));
  res.json({ matchingConversationIds: [...matchingIds] });
});

/* ── POST /conversations ─────────────────────────────────────
   Start or resume a conversation (customer↔seller or any↔admin) */
router.post("/conversations", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { sellerId, productId, orderId, type: convType } = req.body;

  if (!sellerId || typeof sellerId !== "number") {
    res.status(400).json({ error: "sellerId is required" });
    return;
  }

  let customerId: number;
  if (role === "customer" || role === "admin") {
    customerId = userId;
  } else if (role === "seller") {
    customerId = userId;
  } else {
    res.status(403).json({ error: "Cannot start conversation" });
    return;
  }

  if (customerId === sellerId) {
    res.status(400).json({ error: "Cannot message yourself" });
    return;
  }

  const resolvedType = convType || "customer_seller";

  const [partner] = await db
    .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, sellerId));

  if (!partner) { res.status(404).json({ error: "User not found" }); return; }

  let conversation: typeof conversationsTable.$inferSelect | null = null;

  const baseWhere = and(
    eq(conversationsTable.customerId, customerId),
    eq(conversationsTable.sellerId, sellerId),
    eq(conversationsTable.type, resolvedType)
  );

  if (productId) {
    const [existing] = await db
      .select()
      .from(conversationsTable)
      .where(and(baseWhere, eq(conversationsTable.productId, productId)));
    conversation = existing ?? null;
  } else {
    const [existing] = await db
      .select()
      .from(conversationsTable)
      .where(and(baseWhere, isNull(conversationsTable.productId)));
    conversation = existing ?? null;
  }

  if (!conversation) {
    const [created] = await db
      .insert(conversationsTable)
      .values({
        customerId,
        sellerId,
        productId: productId ?? null,
        orderId: orderId ?? null,
        type: resolvedType,
        status: "active",
        muted: false,
        lastMessageAt: new Date(),
      })
      .returning();
    conversation = created;
  }

  if (conversation.status === "blocked") {
    res.status(403).json({ error: "Conversation has been blocked" });
    return;
  }

  let productName: string | null = null;
  if (conversation.productId) {
    const [product] = await db
      .select({ name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, conversation.productId));
    productName = product?.name ?? null;
  }

  const messages = await db
    .select({
      id: messagesTable.id,
      senderId: messagesTable.senderId,
      senderName: usersTable.name,
      body: messagesTable.body,
      attachmentId: messagesTable.attachmentId,
      readAt: messagesTable.readAt,
      deletedAt: messagesTable.deletedAt,
      flagged: messagesTable.flagged,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .innerJoin(usersTable, eq(usersTable.id, messagesTable.senderId))
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(30);

  res.json({
    conversation: {
      ...conversation,
      productName,
      partnerName: partner.name,
      orderId: conversation.orderId ?? null,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
    },
    messages: messages.reverse().map(m => ({
      ...m,
      readAt: m.readAt?.toISOString() ?? null,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

/* ── GET /conversations ──────────────────────────────────────
   List conversations for current user */
router.get("/conversations", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const showArchived = req.query.archived === "true";

  let whereClause: any;
  if (role === "admin") {
    whereClause = sql`(customer_id = ${userId} OR seller_id = ${userId} OR type = 'customer_admin' OR type = 'seller_admin')`;
  } else if (role === "seller") {
    whereClause = eq(conversationsTable.sellerId, userId);
  } else {
    whereClause = eq(conversationsTable.customerId, userId);
  }

  const statusFilter = showArchived
    ? eq(conversationsTable.status, "archived")
    : sql`${conversationsTable.status} NOT IN ('archived','blocked')`;

  const convs = await db
    .select({
      id: conversationsTable.id,
      customerId: conversationsTable.customerId,
      sellerId: conversationsTable.sellerId,
      productId: conversationsTable.productId,
      orderId: conversationsTable.orderId,
      type: conversationsTable.type,
      status: conversationsTable.status,
      muted: conversationsTable.muted,
      lastMessageAt: conversationsTable.lastMessageAt,
      createdAt: conversationsTable.createdAt,
    })
    .from(conversationsTable)
    .where(and(whereClause, statusFilter))
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(100);

  if (!convs.length) { res.json([]); return; }

  const convIds = convs.map(c => c.id);
  const allPartnerIds = convs.flatMap(c => [c.customerId, c.sellerId]);
  const uniquePartnerIds = [...new Set(allPartnerIds)];
  const convIdsList = sql.join(convIds.map(id => sql`${id}`), sql`, `);

  const [partners, lastMsgResult, unreadResult] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, uniquePartnerIds)),

    db.execute<{ conv_id: number; body: string; sender_id: number; created_at: string; attachment_id: number | null }>(
      sql`SELECT DISTINCT ON (conversation_id)
            conversation_id AS conv_id,
            body,
            sender_id,
            created_at,
            attachment_id
          FROM messages
          WHERE conversation_id IN (${convIdsList})
            AND deleted_at IS NULL
          ORDER BY conversation_id, created_at DESC`
    ),

    db.execute<{ conv_id: number; count: number }>(
      sql`SELECT conversation_id AS conv_id, cast(count(*) as int) AS count
          FROM messages
          WHERE conversation_id IN (${convIdsList})
            AND read_at IS NULL
            AND deleted_at IS NULL
            AND sender_id != ${userId}
          GROUP BY conversation_id`
    ),
  ]);

  const partnerMap = new Map(partners.map(p => [p.id, p.name]));
  const lastMsgMap = new Map(
    (lastMsgResult.rows as any[]).map(r => [Number(r.conv_id), r])
  );
  const unreadMap = new Map(
    (unreadResult.rows as any[]).map(r => [Number(r.conv_id), r.count])
  );

  res.json(
    convs.map(c => {
      const partnerId = role === "seller" ? c.customerId : c.sellerId;
      const lastMsg = lastMsgMap.get(c.id) ?? null;
      return {
        id: c.id,
        customerId: c.customerId,
        sellerId: c.sellerId,
        productId: c.productId ?? null,
        orderId: c.orderId ?? null,
        type: c.type,
        status: c.status,
        muted: c.muted,
        partnerName: partnerMap.get(partnerId) ?? partnerMap.get(c.customerId) ?? "Unknown",
        lastMessage: lastMsg ? {
          body: lastMsg.body,
          senderId: Number(lastMsg.sender_id),
          createdAt: new Date(lastMsg.created_at).toISOString(),
          hasAttachment: !!lastMsg.attachment_id,
        } : null,
        unreadCount: unreadMap.get(c.id) ?? 0,
        lastMessageAt: c.lastMessageAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      };
    })
  );
});

/* ── GET /conversations/:id ──────────────────────────────────
   Single conversation detail */
router.get("/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [customerData, sellerData] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, conv.customerId)),
    db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, conv.sellerId)),
  ]);

  let productName: string | null = null;
  if (conv.productId) {
    const [p] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, conv.productId));
    productName = p?.name ?? null;
  }

  res.json({
    ...conv,
    customerName: customerData[0]?.name ?? "Unknown",
    sellerName: sellerData[0]?.name ?? "Unknown",
    productName,
    lastMessageAt: conv.lastMessageAt.toISOString(),
    createdAt: conv.createdAt.toISOString(),
  });
});

/* ── GET /conversations/:id/messages ────────────────────────── */
router.get("/conversations/:id/messages", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 100);
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

  const baseWhere = eq(messagesTable.conversationId, convId);
  const whereClause = before
    ? and(baseWhere, sql`${messagesTable.id} < ${before}`)
    : baseWhere;

  const messages = await db
    .select({
      id: messagesTable.id,
      senderId: messagesTable.senderId,
      senderName: usersTable.name,
      body: messagesTable.body,
      attachmentId: messagesTable.attachmentId,
      readAt: messagesTable.readAt,
      deletedAt: messagesTable.deletedAt,
      flagged: messagesTable.flagged,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .innerJoin(usersTable, eq(usersTable.id, messagesTable.senderId))
    .where(whereClause!)
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  if (role !== "admin" || conv.customerId === userId || conv.sellerId === userId) {
    await db
      .update(messagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messagesTable.conversationId, convId),
          isNull(messagesTable.readAt),
          isNull(messagesTable.deletedAt),
          ne(messagesTable.senderId, userId)
        )
      );
  }

  const msgs = messages.reverse();
  const attachmentIds = msgs.filter(m => m.attachmentId).map(m => m.attachmentId!);
  let attachmentMap = new Map<number, { filename: string; mimeType: string; size: number }>();

  if (attachmentIds.length > 0) {
    const attachments = await db
      .select({ id: messageAttachmentsTable.id, filename: messageAttachmentsTable.filename, mimeType: messageAttachmentsTable.mimeType, size: messageAttachmentsTable.size })
      .from(messageAttachmentsTable)
      .where(inArray(messageAttachmentsTable.id, attachmentIds));
    attachmentMap = new Map(attachments.map(a => [a.id, a]));
  }

  res.json(
    msgs.map(m => ({
      ...m,
      readAt: m.readAt?.toISOString() ?? null,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      attachment: m.attachmentId ? attachmentMap.get(m.attachmentId) ?? null : null,
    }))
  );
});

/* ── POST /conversations/:id/messages ───────────────────────── */
router.post("/conversations/:id/messages", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const { body, attachmentId } = req.body;

  if (!body && !attachmentId) {
    res.status(400).json({ error: "Message body or attachment is required" });
    return;
  }
  if (body && typeof body === "string" && body.length > 2000) {
    res.status(400).json({ error: "Message too long (max 2000 characters)" });
    return;
  }

  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  if (conv.status === "blocked") {
    res.status(403).json({ error: "This conversation has been blocked" });
    return;
  }

  if (attachmentId) {
    const [att] = await db
      .select({ id: messageAttachmentsTable.id })
      .from(messageAttachmentsTable)
      .where(and(eq(messageAttachmentsTable.id, attachmentId), eq(messageAttachmentsTable.conversationId, convId)));
    if (!att) { res.status(400).json({ error: "Invalid attachment" }); return; }
  }

  const recipientId = userId === conv.customerId ? conv.sellerId : conv.customerId;

  const [[inserted], [sender]] = await Promise.all([
    db.insert(messagesTable)
      .values({
        conversationId: convId,
        senderId: userId,
        body: body?.trim() ?? "",
        attachmentId: attachmentId ?? null,
      })
      .returning(),
    db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)),
  ]);

  db.update(conversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, convId))
    .catch(() => {});

  const notifLink = role === "admin"
    ? `/messages`
    : conv.customerId === recipientId ? `/messages` : `/seller/messages`;

  createNotification({
    userId: recipientId,
    type: "new_message",
    title: bi("New Message", "رسالة جديدة"),
    body: `${sender?.name ?? "Someone"}: ${(body?.trim() ?? "📎 Attachment").substring(0, 80)}`,
    link: notifLink,
    priority: "normal",
  }).catch(() => {});

  let attachment = null;
  if (attachmentId) {
    const [att] = await db
      .select({ id: messageAttachmentsTable.id, filename: messageAttachmentsTable.filename, mimeType: messageAttachmentsTable.mimeType, size: messageAttachmentsTable.size })
      .from(messageAttachmentsTable)
      .where(eq(messageAttachmentsTable.id, attachmentId));
    attachment = att ?? null;
  }

  res.status(201).json({
    ...inserted,
    senderName: sender?.name ?? "Unknown",
    readAt: null,
    deletedAt: null,
    createdAt: inserted.createdAt.toISOString(),
    attachment,
  });
});

/* ── DELETE /conversations/:id/messages/:msgId ───────────────
   Soft-delete own message */
router.delete("/conversations/:id/messages/:msgId", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  const msgId = parseInt(String(req.params.msgId), 10);
  if (isNaN(convId) || isNaN(msgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;

  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [msg] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, msgId), eq(messagesTable.conversationId, convId)));
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  if (msg.senderId !== userId && role !== "admin") {
    res.status(403).json({ error: "Cannot delete someone else's message" });
    return;
  }

  await db.update(messagesTable).set({ deletedAt: new Date() }).where(eq(messagesTable.id, msgId));
  res.json({ deleted: true });
});

/* ── PATCH /conversations/:id/read ──────────────────────────
   Explicitly mark all partner messages in conv as read */
router.patch("/conversations/:id/read", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db
    .update(messagesTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messagesTable.conversationId, convId),
        isNull(messagesTable.readAt),
        isNull(messagesTable.deletedAt),
        ne(messagesTable.senderId, userId)
      )
    );

  res.json({ read: true });
});

/* ── PATCH /conversations/:id/archive ────────────────────────
   Toggle archive status */
router.patch("/conversations/:id/archive", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const isArchived = conv.status === "archived";
  await db
    .update(conversationsTable)
    .set({ status: isArchived ? "active" : "archived" })
    .where(eq(conversationsTable.id, convId));

  res.json({ archived: !isArchived });
});

/* ── PATCH /conversations/:id/mute ──────────────────────────
   Toggle mute status */
router.patch("/conversations/:id/mute", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db
    .update(conversationsTable)
    .set({ muted: !conv.muted })
    .where(eq(conversationsTable.id, convId));

  res.json({ muted: !conv.muted });
});

/* ── POST /conversations/:id/typing ─────────────────────────
   Signal that user is typing (no DB write — purely in-memory) */
router.post("/conversations/:id/typing", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(403).json({ error: "Access denied" }); return; }

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  setTyping(convId, userId, user?.name ?? "Someone");
  res.json({ ok: true });
});

/* ── GET /conversations/:id/typing ──────────────────────────
   Get who is currently typing */
router.get("/conversations/:id/typing", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const typingUsers = getTyping(convId, userId);
  res.json({ typing: typingUsers.map(t => t.name) });
});

/* ── POST /conversations/:id/attachments ─────────────────────
   Upload an attachment (JSON body with base64 data) */
router.post("/conversations/:id/attachments", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const { filename, mimeType, size, data } = req.body;
  if (!filename || !mimeType || !data) {
    res.status(400).json({ error: "filename, mimeType, and data are required" });
    return;
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain"];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    res.status(400).json({ error: "File type not allowed" });
    return;
  }

  const ALLOWED_SIGNATURES: Record<string, number[][]> = {
    "image/jpeg": [[0xFF, 0xD8, 0xFF]],
    "image/png":  [[0x89, 0x50, 0x4E, 0x47]],
    "image/webp": [[0x52, 0x49, 0x46, 0x46]],
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  };

  function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
    const signatures = ALLOWED_SIGNATURES[declaredMime];
    if (!signatures) return false;
    return signatures.some(sig =>
      sig.every((byte, i) => buffer[i] === byte)
    );
  }

  const fileBuffer = Buffer.from(String(data), "base64");
  if (!validateMagicBytes(fileBuffer, String(mimeType))) {
    res.status(400).json({ error: "invalid_file_type" });
    return;
  }

  const MAX_SIZE = 2 * 1024 * 1024;
  const numSize = typeof size === "number" ? size : parseInt(String(size), 10);
  if (numSize > MAX_SIZE) {
    res.status(400).json({ error: "File too large (max 2 MB)" });
    return;
  }

  const [attachment] = await db
    .insert(messageAttachmentsTable)
    .values({ conversationId: convId, filename: String(filename), mimeType: String(mimeType), size: numSize, data: String(data) })
    .returning({ id: messageAttachmentsTable.id, filename: messageAttachmentsTable.filename, mimeType: messageAttachmentsTable.mimeType, size: messageAttachmentsTable.size, createdAt: messageAttachmentsTable.createdAt });

  res.status(201).json({
    ...attachment,
    createdAt: attachment.createdAt.toISOString(),
  });
});

/* ── GET /conversations/:id/attachments/:attachId ────────────
   Serve attachment (image viewer / download) */
router.get("/conversations/:id/attachments/:attachId", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  const attachId = parseInt(String(req.params.attachId), 10);
  if (isNaN(convId) || isNaN(attachId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(403).json({ error: "Access denied" }); return; }

  const [att] = await db
    .select()
    .from(messageAttachmentsTable)
    .where(and(eq(messageAttachmentsTable.id, attachId), eq(messageAttachmentsTable.conversationId, convId)));

  if (!att) { res.status(404).json({ error: "Attachment not found" }); return; }

  const buffer = Buffer.from(att.data, "base64");
  res.set("Content-Type", att.mimeType);
  res.set("Content-Disposition", `inline; filename="${att.filename}"`);
  res.set("Cache-Control", "private, max-age=86400");
  res.send(buffer);
});

/* ── POST /conversations/:id/report ─────────────────────────── */
router.post("/conversations/:id/report", requireAuth, async (req, res): Promise<void> => {
  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.user!.userId;
  const role = req.user!.role;
  const { messageId } = req.body;

  const conv = await getConvWithAccess(convId, userId, role);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  if (messageId) {
    await db
      .update(messagesTable)
      .set({ flagged: true })
      .where(and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, convId)));
  }

  res.json({ reported: true });
});

/* ── ADMIN: GET /admin/conversations ────────────────────────
   Admin inbox — all support + flagged conversations */
router.get("/admin/conversations", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const q = String(req.query.q ?? "").trim();
  const convType = String(req.query.type ?? "");
  const showArchived = req.query.archived === "true";

  let whereClause: any = sql`1=1`;
  if (convType) whereClause = and(whereClause, eq(conversationsTable.type, convType));
  if (showArchived) {
    whereClause = and(whereClause, eq(conversationsTable.status, "archived"));
  } else {
    whereClause = and(whereClause, sql`${conversationsTable.status} != 'archived'`);
  }

  const convs = await db
    .select({
      id: conversationsTable.id,
      customerId: conversationsTable.customerId,
      sellerId: conversationsTable.sellerId,
      productId: conversationsTable.productId,
      orderId: conversationsTable.orderId,
      type: conversationsTable.type,
      status: conversationsTable.status,
      muted: conversationsTable.muted,
      lastMessageAt: conversationsTable.lastMessageAt,
      createdAt: conversationsTable.createdAt,
    })
    .from(conversationsTable)
    .where(whereClause)
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(100);

  if (!convs.length) { res.json([]); return; }

  const allIds = [...new Set(convs.flatMap(c => [c.customerId, c.sellerId]))];
  const convIdsList = sql.join(convs.map(c => sql`${c.id}`), sql`, `);

  const [users, lastMsgs, unreadCounts] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, allIds)),
    db.execute<{ conv_id: number; body: string; sender_id: number; created_at: string }>(
      sql`SELECT DISTINCT ON (conversation_id) conversation_id AS conv_id, body, sender_id, created_at
          FROM messages WHERE conversation_id IN (${convIdsList}) AND deleted_at IS NULL
          ORDER BY conversation_id, created_at DESC`
    ),
    db.execute<{ conv_id: number; count: number }>(
      sql`SELECT conversation_id AS conv_id, cast(count(*) as int) AS count
          FROM messages WHERE conversation_id IN (${convIdsList}) AND read_at IS NULL AND deleted_at IS NULL
          GROUP BY conversation_id`
    ),
  ]);

  const userMap = new Map(users.map(u => [u.id, u.name]));
  const lastMsgMap = new Map((lastMsgs.rows as any[]).map(r => [Number(r.conv_id), r]));
  const unreadMap = new Map((unreadCounts.rows as any[]).map(r => [Number(r.conv_id), r.count]));

  let result = convs.map(c => {
    const lastMsg = lastMsgMap.get(c.id) ?? null;
    return {
      id: c.id,
      customerId: c.customerId,
      sellerId: c.sellerId,
      productId: c.productId ?? null,
      orderId: c.orderId ?? null,
      type: c.type,
      status: c.status,
      muted: c.muted,
      customerName: userMap.get(c.customerId) ?? "Unknown",
      sellerName: userMap.get(c.sellerId) ?? "Unknown",
      lastMessage: lastMsg ? {
        body: lastMsg.body,
        senderId: Number(lastMsg.sender_id),
        createdAt: new Date(lastMsg.created_at).toISOString(),
      } : null,
      unreadCount: unreadMap.get(c.id) ?? 0,
      lastMessageAt: c.lastMessageAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    };
  });

  if (q) {
    const ql = q.toLowerCase();
    result = result.filter(c =>
      c.customerName.toLowerCase().includes(ql) ||
      c.sellerName.toLowerCase().includes(ql) ||
      c.lastMessage?.body.toLowerCase().includes(ql)
    );
  }

  res.json(result);
});

/* ── ADMIN: POST /admin/conversations ───────────────────────
   Admin initiates a support conversation with any user */
router.post("/admin/conversations", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const adminId = req.user!.userId;
  const { userId: targetUserId, type: convType } = req.body;

  if (!targetUserId || typeof targetUserId !== "number") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const resolvedType = convType || "customer_admin";
  const [targetUser] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, targetUserId));
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.customerId, targetUserId),
        eq(conversationsTable.sellerId, adminId),
        eq(conversationsTable.type, resolvedType)
      )
    );

  if (existing) {
    res.json({ conversation: { ...existing, lastMessageAt: existing.lastMessageAt.toISOString(), createdAt: existing.createdAt.toISOString() } });
    return;
  }

  const [created] = await db
    .insert(conversationsTable)
    .values({ customerId: targetUserId, sellerId: adminId, type: resolvedType, status: "active", muted: false, lastMessageAt: new Date() })
    .returning();

  res.status(201).json({ conversation: { ...created, lastMessageAt: created.lastMessageAt.toISOString(), createdAt: created.createdAt.toISOString() } });
});

/* ── ADMIN: PATCH /admin/conversations/:id/block ─────────────
   Block or unblock a conversation */
router.patch("/admin/conversations/:id/block", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const convId = parseInt(String(req.params.id), 10);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const isBlocked = conv.status === "blocked";
  await db.update(conversationsTable).set({ status: isBlocked ? "active" : "blocked" }).where(eq(conversationsTable.id, convId));
  res.json({ blocked: !isBlocked });
});

export default router;
