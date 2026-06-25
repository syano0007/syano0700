// @ts-nocheck — Express v5 param types handled via String() casts
/**
 * SYANO Phase 13 — AI Customer Service Agent V1
 *
 * Routes:
 *   GET  /api/support/conversation            → get or create AI support conversation
 *   POST /api/support/message                 → send message + receive AI reply
 *   GET  /api/support/tickets                 → list current user's support tickets
 *   POST /api/support/escalate                → escalate conversation → support ticket
 *   GET  /api/admin/support/tickets           → admin: all support tickets
 *   PATCH /api/admin/support/tickets/:id      → admin: update ticket status/assignment
 *   GET  /api/admin/support/stats             → admin: ticket statistics
 */

import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  conversationsTable,
  messagesTable,
  pool,
} from "@workspace/db";
import { requireAuth, requireActiveAccount } from "../middlewares/auth";
import { getAIProvider, detectLanguage } from "../services/aiProvider";
import { logger } from "../lib/logger";
import { createNotification } from "../lib/notif";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAIAgentUserId(): Promise<number | null> {
  try {
    const [agent] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, "ai-support@syano.internal"))
      .limit(1);
    return agent?.id ?? null;
  } catch {
    return null;
  }
}

async function getOrCreateAIConversation(userId: number): Promise<number | null> {
  const agentId = await getAIAgentUserId();
  if (!agentId) return null;

  // Look for an existing ai_support conversation for this user
  const [existing] = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.customerId, userId),
        eq(conversationsTable.sellerId, agentId),
        sql`${conversationsTable.type} = 'ai_support'`,
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  // Create a new conversation
  const [created] = await db
    .insert(conversationsTable)
    .values({
      customerId: userId,
      sellerId: agentId,
      type: "ai_support",
      status: "active",
    } as any)
    .returning({ id: conversationsTable.id });

  // Send a welcome message from the AI agent
  const agentUser = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, agentId))
    .limit(1);

  // Determine user language preference
  const userRow = await db
    .select({ preferredLanguage: usersTable.preferredLanguage } as any)
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const lang = (userRow[0]?.preferredLanguage === "en" ? "en" : "ar") as "ar" | "en";

  const welcomeMsg =
    lang === "ar"
      ? "أهلاً وسهلاً! 👋\nأنا مساعد سيانو الذكي. كيف يمكنني مساعدتك اليوم؟\n\nيمكنني مساعدتك في:\n• تتبع طلباتك\n• البحث عن المنتجات\n• معلومات الشحن والتوصيل\n• دعم البائعين\n• الإجابة على استفساراتك"
      : "Welcome! 👋\nI'm Syano's Smart Support agent. How can I help you today?\n\nI can help you with:\n• Tracking your orders\n• Finding products\n• Shipping & delivery info\n• Seller support\n• General questions";

  await db.insert(messagesTable).values({
    conversationId: created.id,
    senderId: agentId,
    body: welcomeMsg,
    readAt: null,
  } as any);

  await db
    .update(conversationsTable)
    .set({ lastMessageAt: new Date() } as any)
    .where(eq(conversationsTable.id, created.id));

  return created.id;
}

async function insertSupportTicket(
  userId: number,
  conversationId: number,
  subject: string,
  category: string,
  priority: string,
  source = "page",
): Promise<number | null> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO support_tickets (user_id, conversation_id, subject, category, priority, status, source)
         VALUES ($1, $2, $3, $4, $5, 'open', $6)
         RETURNING id`,
        [userId, conversationId, subject, category, priority, source],
      );
      return Number(res.rows[0]?.id ?? null);
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error({ err }, "[support] insertSupportTicket failed");
    return null;
  }
}

// ─── GET /api/support/conversation ───────────────────────────────────────────
// Get or create the AI support conversation for the current user.

router.get(
  "/support/conversation",
  requireAuth,
  requireActiveAccount,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;

    try {
      const agentId = await getAIAgentUserId();
      if (!agentId) {
        res.status(503).json({ error: "AI support agent not available" });
        return;
      }

      const convId = await getOrCreateAIConversation(userId);
      if (!convId) {
        res.status(503).json({ error: "Could not create support conversation" });
        return;
      }

      // Fetch the conversation with the agent info
      const [conv] = await db
        .select({
          id: conversationsTable.id,
          type: conversationsTable.type,
          status: conversationsTable.status,
          lastMessageAt: conversationsTable.lastMessageAt,
          createdAt: conversationsTable.createdAt,
        })
        .from(conversationsTable)
        .where(eq(conversationsTable.id, convId));

      res.json({
        conversationId: convId,
        agentId,
        agentName: "الدعم الذكي / Smart Support",
        ...conv,
      });
    } catch (err) {
      logger.error({ err }, "[support] GET /support/conversation failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── POST /api/support/message ────────────────────────────────────────────────
// User sends a message; API generates and stores the AI reply.

router.post(
  "/support/message",
  requireAuth,
  requireActiveAccount,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
    const body      = String(req.body.message ?? "").trim();
    const convId    = req.body.conversationId ? Number(req.body.conversationId) : null;
    const source    = String(req.body.source ?? "page");
    const orderId   = req.body.orderId   ? Number(req.body.orderId)   : undefined;
    const productId = req.body.productId ? Number(req.body.productId) : undefined;
    const storeSlug = req.body.storeSlug ? String(req.body.storeSlug) : undefined;

    if (!body) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    try {
      const agentId = await getAIAgentUserId();
      if (!agentId) {
        res.status(503).json({ error: "AI support agent not available" });
        return;
      }

      // Resolve conversation
      let conversationId: number;
      if (convId) {
        conversationId = convId;
      } else {
        const id = await getOrCreateAIConversation(userId);
        if (!id) {
          res.status(503).json({ error: "Could not get support conversation" });
          return;
        }
        conversationId = id;
      }

      // Detect language
      const lang = detectLanguage(body);

      // Insert user message
      const [userMsg] = await db
        .insert(messagesTable)
        .values({
          conversationId,
          senderId: userId,
          body,
        } as any)
        .returning({ id: messagesTable.id, createdAt: messagesTable.createdAt });

      // Update lastMessageAt
      await db
        .update(conversationsTable)
        .set({ lastMessageAt: new Date() } as any)
        .where(eq(conversationsTable.id, conversationId));

      // Fetch recent conversation history (last 6 messages)
      const history = await db
        .select({
          senderId: messagesTable.senderId,
          body: messagesTable.body,
        })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conversationId))
        .orderBy(desc(messagesTable.createdAt))
        .limit(6);

      const contextHistory = history
        .reverse()
        .map((m) => ({
          role: (m.senderId === agentId ? "agent" : "user") as "user" | "agent",
          body: m.body,
        }));

      // Generate AI reply (with page context if provided by widget)
      const provider = getAIProvider();
      const reply = await provider.generateReply({
        userId,
        message: body,
        language: lang,
        history: contextHistory,
        context: { orderId, productId, storeSlug, source: source as "widget" | "page" },
      });

      // Insert AI reply
      let replyBody = reply.body;

      // If escalation triggered: create support ticket and append ticket ID
      if (reply.escalate) {
        const subject = body.slice(0, 100);
        const ticketId = await insertSupportTicket(
          userId,
          conversationId,
          subject,
          "general",
          "normal",
          source,
        );

        // Notify admins
        try {
          await createNotification({
            userId: agentId,
            type: "new_message",
            title: "New Support Request",
            body: `A user has requested human support. Ticket #${ticketId}`,
            link: `/admin/support`,
            priority: "normal",
          });
        } catch {}

        if (ticketId) {
          replyBody = replyBody.replace("{ticketId}", String(ticketId));
          const confirmMsg =
            lang === "ar"
              ? `\n\n✅ **تم تسجيل طلب الدعم**\n📋 **رقم التذكرة:** #${ticketId}\nسيتواصل معك أحد أعضاء فريقنا قريباً.`
              : `\n\n✅ **Support request registered**\n📋 **Ticket ID:** #${ticketId}\nA team member will contact you soon.`;
          replyBody += confirmMsg;
        }
      }

      const [agentMsg] = await db
        .insert(messagesTable)
        .values({
          conversationId,
          senderId: agentId,
          body: replyBody,
        } as any)
        .returning({
          id: messagesTable.id,
          body: messagesTable.body,
          createdAt: messagesTable.createdAt,
        });

      // Update conversation lastMessageAt again
      await db
        .update(conversationsTable)
        .set({ lastMessageAt: new Date() } as any)
        .where(eq(conversationsTable.id, conversationId));

      res.json({
        conversationId,
        userMessage: { id: userMsg.id, body, senderId: userId, createdAt: userMsg.createdAt },
        agentMessage: { ...agentMsg, senderId: agentId },
        intent: reply.intent,
        confidence: reply.confidence,
        escalated: reply.escalate,
        suggestedActions: reply.suggestedActions ?? [],
      });
    } catch (err) {
      logger.error({ err }, "[support] POST /support/message failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── GET /api/support/tickets ─────────────────────────────────────────────────
// List current user's support tickets.

router.get(
  "/support/tickets",
  requireAuth,
  requireActiveAccount,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT st.id, st.status, st.category, st.priority, st.subject,
                  st.created_at, st.updated_at, st.resolved_at,
                  u.name AS assigned_admin_name
           FROM support_tickets st
           LEFT JOIN users u ON u.id = st.assigned_admin_id
           WHERE st.user_id = $1
           ORDER BY st.created_at DESC
           LIMIT 20`,
          [userId],
        );
        res.json(result.rows);
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error({ err }, "[support] GET /support/tickets failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── POST /api/support/escalate ──────────────────────────────────────────────
// Manually escalate a conversation (create support ticket).

router.post(
  "/support/escalate",
  requireAuth,
  requireActiveAccount,
  async (req, res): Promise<void> => {
    const userId = req.user!.userId;
    const conversationId = Number(req.body.conversationId ?? 0);
    const subject = String(req.body.subject ?? "Support Request").slice(0, 200);
    const category = String(req.body.category ?? "general");
    const priority = String(req.body.priority ?? "normal");

    if (!conversationId) {
      res.status(400).json({ error: "conversationId is required" });
      return;
    }

    try {
      const ticketId = await insertSupportTicket(userId, conversationId, subject, category, priority);
      if (!ticketId) {
        res.status(500).json({ error: "Failed to create support ticket" });
        return;
      }

      // Insert escalation message from AI agent
      const agentId = await getAIAgentUserId();
      if (agentId) {
        const lang = (req.body.language ?? "ar") as "ar" | "en";
        const msg =
          lang === "ar"
            ? `✅ **تم تسجيل طلب الدعم**\n📋 **رقم التذكرة:** #${ticketId}\nسيتواصل معك أحد أعضاء فريقنا في أقرب وقت ممكن.`
            : `✅ **Support ticket created**\n📋 **Ticket ID:** #${ticketId}\nA team member will contact you as soon as possible.`;

        await db.insert(messagesTable).values({
          conversationId,
          senderId: agentId,
          body: msg,
        } as any);

        await db
          .update(conversationsTable)
          .set({ lastMessageAt: new Date() } as any)
          .where(eq(conversationsTable.id, conversationId));
      }

      res.json({ ticketId, status: "open", message: "Ticket created successfully" });
    } catch (err) {
      logger.error({ err }, "[support] POST /support/escalate failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── GET /api/admin/support/tickets ──────────────────────────────────────────

router.get(
  "/admin/support/tickets",
  requireAuth,
  requireActiveAccount,
  async (req, res): Promise<void> => {
    if (req.user!.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const status = req.query.status ? String(req.query.status) : null;

    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT st.id, st.status, st.category, st.priority, st.subject,
                  st.conversation_id, st.created_at, st.updated_at, st.resolved_at,
                  u.name AS user_name, u.email AS user_email,
                  a.name AS assigned_admin_name
           FROM support_tickets st
           JOIN users u ON u.id = st.user_id
           LEFT JOIN users a ON a.id = st.assigned_admin_id
           ${status ? "WHERE st.status = $1" : ""}
           ORDER BY
             CASE st.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
             st.created_at DESC
           LIMIT 100`,
          status ? [status] : [],
        );
        res.json(result.rows);
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error({ err }, "[support] GET /admin/support/tickets failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── PATCH /api/admin/support/tickets/:id ────────────────────────────────────

router.patch(
  "/admin/support/tickets/:id",
  requireAuth,
  requireActiveAccount,
  async (req, res): Promise<void> => {
    if (req.user!.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const ticketId = Number(String(req.params.id));
    const { status, assignedAdminId, priority, notes } = req.body;

    try {
      const client = await pool.connect();
      try {
        const updates: string[] = ["updated_at = NOW()"];
        const values: unknown[] = [];
        let idx = 1;

        if (status) {
          updates.push(`status = $${idx++}`);
          values.push(status);
          if (status === "resolved" || status === "closed") {
            updates.push(`resolved_at = NOW()`);
          }
        }
        if (assignedAdminId !== undefined) {
          updates.push(`assigned_admin_id = $${idx++}`);
          values.push(assignedAdminId || null);
        }
        if (priority) {
          updates.push(`priority = $${idx++}`);
          values.push(priority);
        }
        if (notes) {
          updates.push(`notes = $${idx++}`);
          values.push(notes);
        }

        values.push(ticketId);
        const result = await client.query(
          `UPDATE support_tickets SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
          values,
        );

        if (!result.rows[0]) {
          res.status(404).json({ error: "Ticket not found" });
          return;
        }

        res.json(result.rows[0]);
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error({ err }, "[support] PATCH /admin/support/tickets/:id failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── GET /api/admin/support/stats ────────────────────────────────────────────

router.get(
  "/admin/support/stats",
  requireAuth,
  requireActiveAccount,
  async (req, res): Promise<void> => {
    if (req.user!.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT
             count(*) FILTER (WHERE status = 'open')::int       AS open,
             count(*) FILTER (WHERE status = 'pending')::int     AS pending,
             count(*) FILTER (WHERE status = 'resolved')::int    AS resolved,
             count(*) FILTER (WHERE status = 'closed')::int      AS closed,
             count(*)::int                                        AS total,
             count(*) FILTER (WHERE priority = 'urgent')::int    AS urgent,
             count(*) FILTER (WHERE assigned_admin_id IS NULL AND status = 'open')::int AS unassigned
           FROM support_tickets`,
        );
        res.json(result.rows[0] ?? {});
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error({ err }, "[support] GET /admin/support/stats failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
