/**
 * SYANO Phase 13 — AI Provider Abstraction Layer
 *
 * Defines the AIProvider interface so any provider (Claude, OpenAI, Qwen,
 * self-hosted) can be swapped in without rewriting the platform.
 *
 * V1 ships a built-in FAQProvider that uses:
 *  - Keyword-based intent classification
 *  - Structured AR/EN FAQ knowledge base
 *  - Live DB queries for order status + product search
 *
 * The provider is selected via AI_PROVIDER env var (default: "faq").
 */

import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { db, usersTable, productsTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ConvMessage { role: "user" | "agent"; body: string }

export interface AIReplyContext {
  userId: number;
  message: string;
  language: "ar" | "en";
  history: ConvMessage[];
  context?: {
    orderId?:   number;
    productId?: number;
    storeSlug?: string;
    source?:    "widget" | "page";
  };
}

export interface SuggestedAction { label: string; href: string }

export interface AIReply {
  body: string;
  intent: string;
  confidence: number;          // 0–1
  escalate: boolean;
  suggestedActions?: SuggestedAction[];
}

export interface AIProvider {
  generateReply(ctx: AIReplyContext): Promise<AIReply>;
  classifyIntent(text: string, lang: "ar" | "en"): { intent: string; confidence: number };
  searchKnowledge(intent: string, lang: "ar" | "en"): string | null;
}

// ─── Language detection ───────────────────────────────────────────────────────

export function detectLanguage(text: string): "ar" | "en" {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arabicChars > text.length * 0.2 ? "ar" : "en";
}

// ─── Intent classification ────────────────────────────────────────────────────

type Intent =
  | "greeting"
  | "order_status"
  | "order_cancel"
  | "refund"
  | "shipping"
  | "product_search"
  | "seller_info"
  | "account_help"
  | "trust_verification"
  | "escalate"
  | "thanks"
  | "general";

interface IntentPattern { intent: Intent; patterns: string[]; confidence: number }

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "greeting",
    confidence: 0.9,
    patterns: [
      "مرحبا", "هلا", "السلام", "أهلا", "صباح", "مساء",
      "hello", "hi", "hey", "good morning", "good evening",
    ],
  },
  {
    intent: "order_status",
    confidence: 0.95,
    patterns: [
      "طلبي", "طلب", "وين طلبي", "شو حالة", "حالة الطلب", "الطلب ما وصل",
      "ما استلمت", "متى يوصل", "وقت التسليم", "تتبع الطلب",
      "my order", "where is my order", "order status", "track order",
      "order not received", "where is", "when will", "delivery",
    ],
  },
  {
    intent: "order_cancel",
    confidence: 0.92,
    patterns: [
      "ألغي الطلب", "إلغاء", "الغاء", "بدي أرجع", "ما بدي",
      "cancel order", "cancel my order", "how to cancel", "cancellation",
    ],
  },
  {
    intent: "refund",
    confidence: 0.92,
    patterns: [
      "استرداد", "رجوع المبلغ", "استرجاع", "فلوسي", "دفعت",
      "refund", "money back", "return money", "get refund",
    ],
  },
  {
    intent: "shipping",
    confidence: 0.88,
    patterns: [
      "توصيل", "شحن", "كم يأخذ وقت", "رسوم توصيل", "مناطق التوصيل", "مندوب",
      "shipping", "delivery fee", "delivery time", "courier", "shipping cost",
    ],
  },
  {
    intent: "product_search",
    confidence: 0.85,
    patterns: [
      "أبحث عن", "عندكم", "لابتوب", "موبايل", "تلفزيون",
      "هاتف", "سماعات", "أريكة", "عطر", "فستان", "حذاء",
      "اسأل عن", "معلومات المنتج", "هذا المنتج",
      "looking for", "do you have", "laptop", "phone", "mobile",
      "tv", "television", "shoes", "dress", "perfume", "headphones",
      "cheapest", "recommend", "ask about", "this product", "product info",
      "tell me about", "more about",
    ],
  },
  {
    intent: "seller_info",
    confidence: 0.85,
    patterns: [
      "بائع", "متجر", "كيف أبيع", "فتح متجر", "حساب بائع",
      "seller", "store", "how to sell", "open store", "seller account",
      "become seller", "start selling",
    ],
  },
  {
    intent: "account_help",
    confidence: 0.88,
    patterns: [
      "حسابي", "تسجيل", "كلمة المرور", "نسيت", "تحقق", "بريد", "رقم",
      "account", "password", "forgot", "login", "sign in", "register",
      "verification", "email", "phone",
    ],
  },
  {
    intent: "trust_verification",
    confidence: 0.87,
    patterns: [
      "توثيق", "تحقق", "موثوق", "شكوى", "بلاغ", "غش",
      "verification", "verified", "trust", "complaint", "report", "scam", "fraud",
    ],
  },
  {
    intent: "escalate",
    confidence: 0.97,
    patterns: [
      "بدي مشرف", "حولني لمشرف", "تحدث مع إنسان", "كلم إنسان",
      "speak to human", "speak to a human", "talk to human", "talk to a human",
      "real person", "human agent", "live agent", "manager", "supervisor",
      "escalate", "not helpful", "transfer me", "connect me to",
    ],
  },
  {
    intent: "thanks",
    confidence: 0.9,
    patterns: [
      "شكرا", "شكراً", "ممنون", "مشكور", "تمام", "حلو", "رائع",
      "thank", "thanks", "thank you", "great", "perfect", "helpful",
    ],
  },
];

export function classifyIntent(text: string): { intent: Intent; confidence: number } {
  const lower = text.toLowerCase();
  let best: { intent: Intent; confidence: number } = { intent: "general", confidence: 0.3 };

  for (const pattern of INTENT_PATTERNS) {
    for (const kw of pattern.patterns) {
      if (lower.includes(kw)) {
        if (pattern.confidence > best.confidence) {
          best = { intent: pattern.intent, confidence: pattern.confidence };
        }
      }
    }
  }

  return best;
}

// ─── FAQ Knowledge Base ───────────────────────────────────────────────────────

type FAQKey =
  | "order_status_has_orders"
  | "order_status_no_orders"
  | "order_cancel"
  | "refund"
  | "shipping"
  | "product_search_intro"
  | "seller_info"
  | "account_help"
  | "trust_verification"
  | "escalate_confirm"
  | "thanks"
  | "greeting"
  | "general"
  | "error";

const FAQ: Record<FAQKey, { ar: string; en: string }> = {
  greeting: {
    ar: "أهلاً وسهلاً! 👋\nأنا مساعد سيانو الذكي. كيف يمكنني مساعدتك اليوم؟\n\nيمكنني مساعدتك في:\n• تتبع طلباتك\n• البحث عن المنتجات\n• معلومات الشحن والتوصيل\n• دعم البائعين\n• الإجابة على استفساراتك",
    en: "Welcome! 👋\nI'm Syano's Smart Support agent. How can I help you today?\n\nI can help you with:\n• Tracking your orders\n• Finding products\n• Shipping & delivery info\n• Seller support\n• General questions",
  },
  order_status_has_orders: {
    ar: "إليك آخر طلباتك:",
    en: "Here are your recent orders:",
  },
  order_status_no_orders: {
    ar: "لا يوجد لديك أي طلبات حتى الآن. هل تريد تصفح منتجاتنا؟\n👉 [تصفح المنتجات](/shop)",
    en: "You don't have any orders yet. Would you like to browse our products?\n👉 [Browse Products](/shop)",
  },
  order_cancel: {
    ar: "**إلغاء الطلب**\n\n• يمكن إلغاء الطلب فقط إذا كان في حالة **انتظار** أو **مؤكد**\n• بمجرد تجهيز الطلب لا يمكن إلغاؤه\n• للإلغاء: اذهب إلى [طلباتي](/orders) واضغط على زر الإلغاء\n\nإذا احتجت مساعدة إضافية، أخبرني برقم الطلب وسأساعدك.",
    en: "**Order Cancellation**\n\n• Orders can only be cancelled when status is **Pending** or **Confirmed**\n• Once your order is being prepared, it cannot be cancelled\n• To cancel: go to [My Orders](/orders) and click the Cancel button\n\nIf you need further help, tell me your order number and I'll assist you.",
  },
  refund: {
    ar: "**سياسة الاسترداد**\n\n• يتم معالجة طلبات الاسترداد خلال **3–7 أيام عمل**\n• الاسترداد ممكن في الحالات التالية:\n  - المنتج وصل تالفاً\n  - المنتج لا يطابق الوصف\n  - الطلب ألغي قبل التجهيز\n\nللطلب استرداد، توجه إلى [طلباتي](/orders) وافتح تفاصيل الطلب.\n\nإذا كانت لديك مشكلة محددة، أخبرني ورقم الطلب وسأرفعها للمختصين.",
    en: "**Refund Policy**\n\n• Refund requests are processed within **3–7 business days**\n• Refunds are possible in these cases:\n  - Product arrived damaged\n  - Product doesn't match description\n  - Order cancelled before preparation\n\nTo request a refund, go to [My Orders](/orders) and open the order details.\n\nIf you have a specific issue, share your order number and I'll escalate it.",
  },
  shipping: {
    ar: "**الشحن والتوصيل**\n\n• نوصل حالياً إلى **مناطق حلب** الرئيسية\n• رسوم التوصيل تبدأ من **1,000 ل.س** وتختلف حسب المنطقة\n• وقت التوصيل المتوقع: **1–3 أيام عمل**\n• يمكنك تتبع طلبك عبر [طلباتي](/orders)\n\nهل تريد معرفة رسوم منطقة معينة؟",
    en: "**Shipping & Delivery**\n\n• We currently deliver to main **Aleppo** districts\n• Delivery fees start from **1,000 SYP** and vary by zone\n• Expected delivery time: **1–3 business days**\n• Track your order via [My Orders](/orders)\n\nWould you like to know the fee for a specific area?",
  },
  product_search_intro: {
    ar: "سأبحث لك في كتالوج منتجاتنا. إليك ما وجدته:",
    en: "Let me search our product catalog for you. Here's what I found:",
  },
  seller_info: {
    ar: "**كيف تصبح بائعاً على سيانو؟**\n\n1. سجّل حساباً على المنصة\n2. اذهب إلى [قدّم كبائع](/seller/apply) واملأ النموذج\n3. أرفق المستندات المطلوبة\n4. انتظر مراجعة الطلب (عادةً خلال 24–48 ساعة)\n5. بعد الموافقة، ابدأ بإضافة منتجاتك!\n\nمزايا البائع:\n✅ لوحة تحكم متكاملة\n✅ تحليلات المبيعات\n✅ نظام التقييمات\n✅ دعم فني مخصص",
    en: "**How to become a seller on Syano?**\n\n1. Register an account on the platform\n2. Go to [Apply as Seller](/seller/apply) and fill the form\n3. Attach required documents\n4. Wait for review (usually 24–48 hours)\n5. After approval, start adding your products!\n\nSeller benefits:\n✅ Full dashboard & analytics\n✅ Sales tracking\n✅ Review system\n✅ Dedicated support",
  },
  account_help: {
    ar: "**مساعدة الحساب**\n\n• **نسيت كلمة المرور؟** اضغط على [نسيت كلمة المرور](/forgot-password)\n• **مشكلة في التحقق؟** تحقق من بريدك الإلكتروني أو رقم هاتفك\n• **تغيير معلومات الحساب؟** توجه إلى الإعدادات\n\nإذا كان الأمر أكثر تعقيداً، سأحوّلك لفريق الدعم البشري.",
    en: "**Account Help**\n\n• **Forgot password?** Click [Forgot Password](/forgot-password)\n• **Verification issue?** Check your email or phone number\n• **Change account info?** Go to Settings\n\nIf the issue is more complex, I'll transfer you to our human support team.",
  },
  trust_verification: {
    ar: "**التوثيق والثقة على سيانو**\n\n• البائعون الموثوقون يحملون شارة التحقق ✅\n• يتم التحقق من البائعين عبر مراجعة الوثائق الرسمية\n• يمكنك **الإبلاغ عن بائع** من خلال صفحة المتجر\n\nإذا واجهتك مشكلة مع بائع أو منتج، يمكنني رفع بلاغ للفريق الإداري.",
    en: "**Trust & Verification on Syano**\n\n• Verified sellers carry a verification badge ✅\n• Sellers are verified through official document review\n• You can **report a seller** from their store page\n\nIf you have an issue with a seller or product, I can escalate a report to our admin team.",
  },
  escalate_confirm: {
    ar: "✅ **تم تسجيل طلب الدعم**\n\nسيتواصل معك أحد أعضاء فريقنا في أقرب وقت ممكن.\n\n📋 **رقم التذكرة:** #{ticketId}\n\nيمكنك متابعة حالة التذكرة عبر قسم الدعم.",
    en: "✅ **Support request registered**\n\nOne of our team members will contact you as soon as possible.\n\n📋 **Ticket ID:** #{ticketId}\n\nYou can track your ticket status in the Support section.",
  },
  thanks: {
    ar: "على الرحب والسعة! 😊\nسعيد بمساعدتك. هل هناك شيء آخر يمكنني مساعدتك به؟",
    en: "You're welcome! 😊\nHappy to help. Is there anything else I can assist you with?",
  },
  general: {
    ar: "شكراً على تواصلك مع سيانو! 🌟\n\nيمكنني مساعدتك في:\n• **تتبع الطلبات** — اسألني \"وين طلبي؟\"\n• **البحث عن منتجات** — أخبرني ما تبحث عنه\n• **معلومات الشحن** — اسأل عن التوصيل\n• **دعم البائعين** — اسأل كيف تبيع\n\nأو اكتب **\"حولني للدعم\"** للتحدث مع أحد أعضاء الفريق.",
    en: "Thanks for contacting Syano support! 🌟\n\nI can help you with:\n• **Order tracking** — ask \"Where's my order?\"\n• **Product search** — tell me what you're looking for\n• **Shipping info** — ask about delivery\n• **Seller support** — ask how to sell\n\nOr type **\"speak to human\"** to connect with our team.",
  },
  error: {
    ar: "عذراً، حدث خطأ مؤقت. يرجى المحاولة مرة أخرى أو التحدث مع أحد أعضاء الفريق.",
    en: "Sorry, a temporary error occurred. Please try again or speak with one of our team members.",
  },
};

// ─── DB helpers (order lookup + product search) ───────────────────────────────

interface OrderSummary {
  id: number;
  status: string;
  total: string;
  createdAt: Date;
  itemCount: number;
}

async function getOrderById(userId: number, orderId: number): Promise<OrderSummary | null> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT o.id, o.status, o.total::text, o.created_at,
                count(oi.id)::int AS item_count
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.customer_id = $1 AND o.id = $2
         GROUP BY o.id`,
        [userId, orderId],
      );
      if (!res.rows[0]) return null;
      const r = res.rows[0] as any;
      return { id: r.id, status: r.status, total: r.total, createdAt: r.created_at, itemCount: r.item_count ?? 0 };
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error({ err }, "[AI] getOrderById failed");
    return null;
  }
}

async function getUserOrders(userId: number): Promise<OrderSummary[]> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT o.id, o.status, o.total::text, o.created_at,
                count(oi.id)::int AS item_count
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.customer_id = $1
         GROUP BY o.id
         ORDER BY o.created_at DESC
         LIMIT 5`,
        [userId],
      );
      return (res.rows as any[]).map((r) => ({
        id: r.id,
        status: r.status,
        total: r.total,
        createdAt: r.created_at,
        itemCount: r.item_count ?? 0,
      }));
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error({ err }, "[AI] getUserOrders failed");
    return [];
  }
}

interface ProductHit {
  id: number;
  name: string;
  nameAr: string;
  price: string;
  currency: string;
}

async function getProductById(productId: number): Promise<ProductHit | null> {
  try {
    const results = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        nameAr: productsTable.nameAr,
        price: productsTable.price,
      })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);
    if (!results[0]) return null;
    const r = results[0];
    return { id: r.id, name: r.name, nameAr: r.nameAr ?? r.name, price: String(r.price), currency: "SYP" };
  } catch {
    return null;
  }
}

async function searchProducts(query: string, limit = 3): Promise<ProductHit[]> {
  try {
    const results = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        nameAr: productsTable.nameAr,
        price: productsTable.price,
      })
      .from(productsTable)
      .where(
        sql`(${productsTable.name} ILIKE ${`%${query}%`} OR ${productsTable.nameAr} ILIKE ${`%${query}%`})`
      )
      .limit(limit);
    return results.map((r) => ({
      id: r.id,
      name: r.name,
      nameAr: r.nameAr ?? r.name,
      price: String(r.price),
      currency: "SYP",
    }));
  } catch {
    return [];
  }
}

function orderStatusLabel(status: string, lang: "ar" | "en"): string {
  const labels: Record<string, { ar: string; en: string }> = {
    pending:               { ar: "في الانتظار",    en: "Pending" },
    confirmed:             { ar: "مؤكد",            en: "Confirmed" },
    preparing:             { ar: "قيد التجهيز",    en: "Preparing" },
    ready_for_pickup:      { ar: "جاهز للاستلام",  en: "Ready for Pickup" },
    courier_assigned:      { ar: "مندوب معيّن",    en: "Courier Assigned" },
    picked_up:             { ar: "تم الاستلام",    en: "Picked Up" },
    in_transit:            { ar: "في الطريق",      en: "In Transit" },
    out_for_delivery:      { ar: "خارج للتوصيل",  en: "Out for Delivery" },
    delivered:             { ar: "تم التسليم ✅",  en: "Delivered ✅" },
    delivery_failed:       { ar: "فشل التوصيل",   en: "Delivery Failed" },
    cancelled:             { ar: "ملغي",           en: "Cancelled" },
    returned:              { ar: "مُعاد",           en: "Returned" },
    refunded:              { ar: "مسترد",           en: "Refunded" },
  };
  return labels[status]?.[lang] ?? status;
}

// ─── FAQ AI Provider (V1 — built-in, no external API) ────────────────────────

export class FAQProvider implements AIProvider {
  classifyIntent(text: string, _lang: "ar" | "en") {
    return classifyIntent(text);
  }

  searchKnowledge(intent: string, lang: "ar" | "en"): string | null {
    const key = intent as FAQKey;
    const entry = FAQ[key];
    if (!entry) return null;
    return entry[lang];
  }

  async generateReply(ctx: AIReplyContext): Promise<AIReply> {
    const { userId, message, language: lang, context: pageCtx } = ctx;
    const { intent, confidence } = classifyIntent(message);

    try {
      // ── Order status ───────────────────────────────────────────────────────
      if (intent === "order_status") {
        // If widget sent a specific orderId, look up that order first
        if (pageCtx?.orderId) {
          const specificOrder = await getOrderById(userId, pageCtx.orderId);
          if (specificOrder) {
            const statusLabel = orderStatusLabel(specificOrder.status, lang);
            const date = new Date(specificOrder.createdAt).toLocaleDateString(lang === "ar" ? "ar-SY" : "en-US");
            const body = lang === "ar"
              ? `📦 **طلب #${specificOrder.id}**\n• الحالة: ${statusLabel}\n• ${specificOrder.itemCount} منتج\n• تاريخ الطلب: ${date}\n\n👉 [عرض تفاصيل الطلب](/orders/${specificOrder.id})`
              : `📦 **Order #${specificOrder.id}**\n• Status: ${statusLabel}\n• ${specificOrder.itemCount} item(s)\n• Ordered: ${date}\n\n👉 [View order details](/orders/${specificOrder.id})`;
            return {
              body,
              intent,
              confidence,
              escalate: false,
              suggestedActions: [{ label: lang === "ar" ? "تفاصيل الطلب" : "Order Details", href: `/orders/${specificOrder.id}` }],
            };
          }
        }

        const orders = await getUserOrders(userId);
        if (orders.length === 0) {
          return {
            body: FAQ.order_status_no_orders[lang],
            intent,
            confidence,
            escalate: false,
            suggestedActions: [{ label: lang === "ar" ? "تصفح المنتجات" : "Browse Products", href: "/shop" }],
          };
        }

        const intro = FAQ.order_status_has_orders[lang];
        const lines = orders.map((o) => {
          const statusLabel = orderStatusLabel(o.status, lang);
          const date = new Date(o.createdAt).toLocaleDateString(lang === "ar" ? "ar-SY" : "en-US");
          if (lang === "ar") {
            return `📦 **طلب #${o.id}** — ${statusLabel}\n   ${o.itemCount} منتج · ${date}`;
          }
          return `📦 **Order #${o.id}** — ${statusLabel}\n   ${o.itemCount} item(s) · ${date}`;
        });

        const footer = lang === "ar"
          ? "\n\n👉 [عرض جميع طلباتي](/orders)"
          : "\n\n👉 [View all my orders](/orders)";

        return {
          body: `${intro}\n\n${lines.join("\n\n")}${footer}`,
          intent,
          confidence,
          escalate: false,
          suggestedActions: [{ label: lang === "ar" ? "طلباتي" : "My Orders", href: "/orders" }],
        };
      }

      // ── Product search ─────────────────────────────────────────────────────
      // Also trigger product context path when widget sends productId with a general/unknown message
      const effectiveProductSearch = intent === "product_search" || (pageCtx?.productId && (intent === "general" || intent === "greeting"));
      if (effectiveProductSearch) {
        // If widget provided a specific productId, describe that product
        if (pageCtx?.productId) {
          const product = await getProductById(pageCtx.productId);
          if (product) {
            const displayName = lang === "ar" ? product.nameAr : product.name;
            const price = Number(product.price).toLocaleString();
            const currency = product.currency === "SYP" ? "ل.س" : product.currency;
            const body = lang === "ar"
              ? `📦 **${displayName}**\nالسعر: ${price} ${currency}\n\n👉 [عرض المنتج](/products/${product.id})\n\nهل تريد إضافته للسلة أو تريد معرفة المزيد؟`
              : `📦 **${displayName}**\nPrice: ${price} ${currency}\n\n👉 [View Product](/products/${product.id})\n\nWould you like to add it to your cart or learn more?`;
            return {
              body,
              intent,
              confidence,
              escalate: false,
              suggestedActions: [{ label: lang === "ar" ? "عرض المنتج" : "View Product", href: `/products/${product.id}` }],
            };
          }
        }

        const searchTerm = message
          .replace(/بدي|أبحث عن|عندكم|i want|looking for|do you have|find me/gi, "")
          .trim()
          .slice(0, 60);

        const products = await searchProducts(searchTerm);
        const intro = FAQ.product_search_intro[lang];

        if (products.length === 0) {
          const noResults = lang === "ar"
            ? `لم أجد منتجات مطابقة لـ "${searchTerm}".\nجرّب البحث في [صفحة المتجر](/shop) للمزيد من الخيارات.`
            : `No products found matching "${searchTerm}".\nTry searching in our [Shop page](/shop) for more options.`;
          return {
            body: noResults,
            intent,
            confidence,
            escalate: false,
            suggestedActions: [{ label: lang === "ar" ? "تصفح المتجر" : "Browse Shop", href: "/shop" }],
          };
        }

        const lines = products.map((p) => {
          const displayName = lang === "ar" ? p.nameAr : p.name;
          const price = Number(p.price).toLocaleString();
          const currency = p.currency === "SYP" ? "ل.س" : p.currency;
          return `• **[${displayName}](/products/${p.id})** — ${price} ${currency}`;
        });

        return {
          body: `${intro}\n\n${lines.join("\n")}\n\n👉 [${lang === "ar" ? "عرض النتائج الكاملة" : "See all results"}](/shop?q=${encodeURIComponent(searchTerm)})`,
          intent,
          confidence,
          escalate: false,
          suggestedActions: products.map((p) => ({
            label: lang === "ar" ? p.nameAr : p.name,
            href: `/products/${p.id}`,
          })),
        };
      }

      // ── Escalation ─────────────────────────────────────────────────────────
      if (intent === "escalate") {
        return {
          body: lang === "ar"
            ? "سأحوّلك الآن إلى أحد أعضاء فريق الدعم. يرجى الانتظار قليلاً..."
            : "I'm connecting you with a human support agent now. Please wait a moment...",
          intent,
          confidence,
          escalate: true,
        };
      }

      // ── FAQ lookup ─────────────────────────────────────────────────────────
      const faqKey: FAQKey | null =
        intent === "order_cancel"        ? "order_cancel"
        : intent === "refund"           ? "refund"
        : intent === "shipping"         ? "shipping"
        : intent === "seller_info"      ? "seller_info"
        : intent === "account_help"     ? "account_help"
        : intent === "trust_verification" ? "trust_verification"
        : intent === "thanks"           ? "thanks"
        : intent === "greeting"         ? "greeting"
        : null;

      if (faqKey) {
        return {
          body: FAQ[faqKey][lang],
          intent,
          confidence,
          escalate: false,
        };
      }

      // ── General fallback ───────────────────────────────────────────────────
      return {
        body: FAQ.general[lang],
        intent: "general",
        confidence: 0.4,
        escalate: false,
      };
    } catch (err) {
      logger.error({ err }, "[AI] generateReply error");
      return {
        body: FAQ.error[lang],
        intent: "error",
        confidence: 0,
        escalate: false,
      };
    }
  }
}

// ─── Provider factory ─────────────────────────────────────────────────────────

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!_provider) {
    const name = process.env.AI_PROVIDER ?? "faq";
    if (name === "faq") {
      _provider = new FAQProvider();
    } else {
      // Future: load external provider by name
      logger.warn({ name }, "[AI] Unknown AI_PROVIDER — falling back to FAQ");
      _provider = new FAQProvider();
    }
  }
  return _provider;
}

export { FAQ, getUserOrders };
