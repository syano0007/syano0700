// @refresh reset
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import {
  Bot, X, Send, ExternalLink, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGetMessages, getMessagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

// ── Page context detection ──────────────────────────────────────────────────

type PageCtx =
  | { type: "order";   orderId: string }
  | { type: "product"; productId: string }
  | { type: "store";   storeSlug: string }
  | { type: "default" };

function detectContext(path: string): PageCtx {
  const m1 = path.match(/^\/orders\/(\d+)/);
  if (m1) return { type: "order", orderId: m1[1] };
  const m2 = path.match(/^\/products\/(\d+)/);
  if (m2) return { type: "product", productId: m2[1] };
  const m3 = path.match(/^\/store\/([^/?#]+)/);
  if (m3) return { type: "store", storeSlug: m3[1] };
  return { type: "default" };
}

function shouldHideWidget(path: string, role?: string | null): boolean {
  if (role === "admin" || role === "seller" || role === "courier") return true;
  const excluded = ["/support", "/login", "/register", "/verify", "/account-suspended"];
  return excluded.some((p) => path.startsWith(p));
}

// ── Typing indicator ────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-1.5">
      <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mb-1">
        <Bot className="h-3 w-3 text-primary" />
      </div>
      <div className="flex items-center gap-1 bg-muted px-3 py-2.5 rounded-2xl rounded-bl-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Widget ──────────────────────────────────────────────────────────────────

export default function SupportWidget() {
  const [location] = useLocation();
  const { user, token } = useAuth();
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const queryClient = useQueryClient();

  const [open, setOpen]                         = useState(false);
  const [conversationId, setConversationId]     = useState<number | null>(null);
  const [agentId, setAgentId]                   = useState<number | null>(null);
  const [convLoading, setConvLoading]           = useState(false);
  const [inputText, setInputText]               = useState("");
  const [sending, setSending]                   = useState(false);
  const [typing, setTyping]                     = useState(false);
  const [unreadCount, setUnreadCount]           = useState(0);

  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const lastSeenAtRef    = useRef<Date>(new Date());

  const ctx     = detectContext(location);
  const hidden  = shouldHideWidget(location, user?.role);

  // ── Fetch conversation on first open ─────────────────────────────────────
  useEffect(() => {
    if (!open || !token || conversationId !== null) return;
    setConvLoading(true);
    fetch("/api/support/conversation", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.conversationId) {
          setConversationId(data.conversationId);
          setAgentId(data.agentId);
        }
      })
      .catch(() => {})
      .finally(() => setConvLoading(false));
  }, [open, token, conversationId]);

  // ── Poll messages (shared query key with /support page) ───────────────────
  const { data: messages = [] } = useGetMessages(conversationId ?? 0, {
    query: {
      enabled: !!conversationId,
      refetchInterval: open ? 3000 : 20000,
      queryKey: getMessagesQueryKey(conversationId ?? 0),
    },
  });

  // ── Unread count while widget is closed ───────────────────────────────────
  useEffect(() => {
    if (open || !agentId) return;
    const count = messages.filter(
      (m) => m.senderId === agentId && new Date(m.createdAt) > lastSeenAtRef.current,
    ).length;
    setUnreadCount(count);
  }, [messages, agentId, open]);

  // ── On open: mark seen + scroll + focus ───────────────────────────────────
  useEffect(() => {
    if (!open) return;
    lastSeenAtRef.current = new Date();
    setUnreadCount(0);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 160);
  }, [open]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [messages.length, typing, open]);

  // ── Escape to close ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? inputText).trim();
      if (!msg || sending || !conversationId || !token) return;
      if (!text) setInputText("");
      setSending(true);
      setTyping(true);

      const payload: Record<string, unknown> = { message: msg, conversationId, source: "widget" };
      if (ctx.type === "order")   payload.orderId    = Number(ctx.orderId);
      if (ctx.type === "product") payload.productId  = Number(ctx.productId);
      if (ctx.type === "store")   payload.storeSlug  = ctx.storeSlug;

      try {
        const r = await fetch("/api/support/message", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        queryClient.invalidateQueries({ queryKey: getMessagesQueryKey(conversationId) });
      } catch {
        if (!text) setInputText(msg);
      } finally {
        setSending(false);
        setTyping(false);
      }
    },
    [inputText, sending, conversationId, token, ctx, queryClient],
  );

  // ── Context-aware quick actions ───────────────────────────────────────────
  const quickActions =
    ctx.type === "order"
      ? [
          { label: t("support.widget_ctx_track"),      msg: `Track order #${ctx.orderId}` },
          { label: t("support.widget_ctx_issue"),      msg: `Report issue with order #${ctx.orderId}` },
          { label: t("support.widget_ctx_delivery_q"), msg: `Delivery question for order #${ctx.orderId}` },
        ]
      : ctx.type === "product"
      ? [
          { label: t("support.widget_ctx_ask_product"),     msg: `Ask about product #${ctx.productId}` },
          { label: t("support.widget_ctx_availability"),    msg: `Is product #${ctx.productId} available?` },
          { label: t("support.widget_ctx_delivery_product"),msg: t("support.prompt_shipping") },
        ]
      : ctx.type === "store"
      ? [
          { label: t("support.widget_ctx_contact_seller"),  msg: `Contact seller ${ctx.storeSlug}` },
          { label: t("support.widget_ctx_seller_info"),     msg: `Seller info for ${ctx.storeSlug}` },
          { label: t("support.widget_ctx_shipping_policy"), msg: t("support.prompt_shipping") },
        ]
      : [
          { label: t("support.prompt_orders"),   msg: t("support.prompt_orders") },
          { label: t("support.prompt_shipping"),  msg: t("support.prompt_shipping") },
          { label: t("support.prompt_seller"),    msg: t("support.prompt_seller") },
          { label: t("support.prompt_help"),      msg: t("support.prompt_help") },
        ];

  const showQuickActions = token && !convLoading && messages.length <= 2 && !sending;

  // ── Render ────────────────────────────────────────────────────────────────
  if (hidden) return null;

  const positionStyle: React.CSSProperties =
    dir === "rtl"
      ? { bottom: "1rem", left: "1rem" }
      : { bottom: "1rem", right: "1rem" };

  return (
    <div
      dir={dir}
      className="fixed z-[9998] flex flex-col items-end"
      style={positionStyle}
    >
      {/* ── Expanded panel ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="mb-3 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 transition-all"
          style={{ width: "clamp(320px, 90vw, 380px)", height: "clamp(400px, 72dvh, 520px)" }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-card">
            <div className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Bot className="h-[18px] w-[18px] text-primary" />
                <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-sm font-semibold leading-none">{t("support.agent_name")}</p>
                  <span className="text-[9px] font-medium text-emerald-600">{t("support.online")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{t("support.agent_subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Link href="/support">
                <button
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title={t("support.widget_open_full")}
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
            {convLoading ? (
              <div className="space-y-3 pt-2 animate-pulse">
                <div className="flex gap-2 items-end">
                  <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-48 bg-muted rounded-xl" />
                    <div className="h-4 w-36 bg-muted rounded-xl" />
                    <div className="h-4 w-40 bg-muted rounded-xl" />
                  </div>
                </div>
              </div>
            ) : !token ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-semibold mb-1">{t("support.agent_name")}</p>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed max-w-[200px]">
                  {t("support.widget_login_prompt")}
                </p>
                <Link href="/login" onClick={() => setOpen(false)}>
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                    {t("support.widget_login_btn")}
                  </button>
                </Link>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-4">
                <Bot className="h-10 w-10 mx-auto mb-3 text-primary opacity-25" />
                <p className="text-xs text-muted-foreground">{t("support.empty_state")}</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isAgent = msg.senderId === agentId;
                  return (
                    <div key={msg.id} className={`flex items-end gap-1.5 ${isAgent ? "justify-start" : "justify-end"}`}>
                      {isAgent && (
                        <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mb-1">
                          <Bot className="h-3 w-3 text-primary" />
                        </div>
                      )}
                      <div className={`max-w-[78%] flex flex-col ${isAgent ? "items-start" : "items-end"}`}>
                        <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                          isAgent
                            ? "bg-muted text-foreground rounded-bl-sm"
                            : "bg-primary text-primary-foreground rounded-br-sm"
                        }`}>
                          {msg.body}
                        </div>
                        <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {typing && <TypingDots />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Quick actions */}
          {showQuickActions && (
            <div className="px-3 pb-2 shrink-0 flex flex-wrap gap-1.5">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => handleSend(a.msg)}
                  disabled={sending}
                  className="text-[11px] bg-primary/5 border border-primary/20 text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          {token && (
            <div className="shrink-0 px-2.5 pb-2.5 pt-2 border-t bg-card">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder={t("support.input_placeholder")}
                  className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[38px] max-h-20"
                  rows={1}
                  disabled={sending || (!conversationId && !!token)}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!inputText.trim() || sending || (!conversationId && !!token)}
                  className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {sending
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Collapsed button — circular on all screen sizes (48px touch target) ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "relative flex items-center justify-center transition-all duration-200 focus:outline-none",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60",
          /* circular on all screen sizes — 48px touch target */
          "h-12 w-12 rounded-full p-0 shadow-lg",
          open
            ? "bg-muted text-foreground border border-border hover:bg-muted/80 shadow-none"
            : "bg-primary text-primary-foreground shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-110 active:scale-95",
        ].join(" ")}
        aria-label={t("support.agent_name")}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {open ? (
          <X className="h-5 w-5 shrink-0" />
        ) : (
          <Bot className="h-5 w-5 shrink-0" />
        )}

        {/* Unread badge */}
        {unreadCount > 0 && !open && (
          <span
            className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-card"
            aria-label={`${unreadCount} unread messages`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
