import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Send, AlertCircle, ArrowLeft, Ticket, ChevronRight, Sparkles, RefreshCw } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useGetMessages, getMessagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface SuggestedAction { label: string; href: string }
interface Ticket {
  id: number;
  status: string;
  category: string;
  priority: string;
  subject: string;
  created_at: string;
  assigned_admin_name: string | null;
}

function TypingDots() {
  return (
    <div className="flex items-end gap-1.5 ps-1">
      <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-center gap-1 bg-muted px-4 py-3 rounded-2xl rounded-bl-sm">
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

function PriorityBadge({ priority }: { priority: string }) {
  const color =
    priority === "urgent"
      ? "bg-red-500/10 text-red-600 border-red-200"
      : priority === "high"
      ? "bg-orange-500/10 text-orange-600 border-orange-200"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${color}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "open"
      ? "bg-blue-500/10 text-blue-600 border-blue-200"
      : status === "pending"
      ? "bg-amber-500/10 text-amber-600 border-amber-200"
      : status === "resolved"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${color}`}>
      {status}
    </span>
  );
}

export default function CustomerSupportPage() {
  const { t, i18n } = useTranslation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dir = i18n.dir();

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedAction[]>([]);
  const [view, setView] = useState<"chat" | "tickets">("chat");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch / create AI support conversation
  useEffect(() => {
    if (!token) return;

    fetch("/api/support/conversation", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.conversationId) {
          setConversationId(data.conversationId);
          setAgentId(data.agentId);
        }
      })
      .catch(() => {
        toast({ title: t("support.error_load"), variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Load messages via the existing messages API (polling every 3s)
  const { data: messages = [], isLoading: msgsLoading } = useGetMessages(
    conversationId ?? 0,
    {
      query: {
        enabled: !!conversationId,
        refetchInterval: 3000,
        queryKey: getMessagesQueryKey(conversationId ?? 0),
      },
    }
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages.length, typing]);

  const fetchTickets = async () => {
    if (!token) return;
    setTicketsLoading(true);
    try {
      const r = await fetch("/api/support/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: t("support.error_load"), variant: "destructive" });
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    if (view === "tickets") fetchTickets();
  }, [view]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending || !conversationId) return;
    setInputText("");
    setSending(true);
    setSuggestions([]);

    // Show typing indicator
    setTyping(true);

    try {
      const r = await fetch("/api/support/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await r.json();

      if (!r.ok) throw new Error(data.error ?? "Failed");

      // The server already inserted both messages — invalidate the query
      queryClient.invalidateQueries({ queryKey: getMessagesQueryKey(conversationId) });

      if (data.suggestedActions?.length) {
        setSuggestions(data.suggestedActions);
      }
    } catch {
      toast({ title: t("support.error_send"), variant: "destructive" });
      setInputText(text);
    } finally {
      setSending(false);
      setTyping(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-20 text-center">
          <Bot className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground">{t("messages.login_prompt")}</p>
          <Link href="/login">
            <Button className="mt-4">{t("messages.login_btn")}</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-20 flex justify-center">
          <div className="space-y-3 w-full">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden bg-background text-foreground" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{t("support.agent_name")}</p>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t("support.online")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("support.agent_subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "chat" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("chat")}
            className="text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 me-1.5" />
            {t("support.chat_tab")}
          </Button>
          <Button
            variant={view === "tickets" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("tickets")}
            className="text-xs"
          >
            <Ticket className="h-3.5 w-3.5 me-1.5" />
            {t("support.tickets_tab")}
          </Button>
        </div>
      </div>

      {/* Chat View */}
      {view === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" dir={dir}>
            {msgsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-64 rounded-2xl" />
                <Skeleton className="h-20 w-48 rounded-2xl self-end ms-auto" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <Bot className="h-14 w-14 mx-auto mb-4 text-primary opacity-30" />
                <p className="text-muted-foreground text-sm">{t("support.empty_state")}</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isAgent = msg.senderId === agentId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isAgent ? "justify-start" : "justify-end"}`}
                    >
                      {isAgent && (
                        <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mb-1">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div className={`max-w-[75%] flex flex-col ${isAgent ? "items-start" : "items-end"}`}>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            isAgent
                              ? "bg-muted text-foreground rounded-bl-sm"
                              : "bg-primary text-primary-foreground rounded-br-sm"
                          }`}
                        >
                          {msg.body}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {typing && <TypingDots />}

                {/* Suggested actions */}
                {suggestions.length > 0 && !typing && (
                  <div className="flex flex-wrap gap-2 ps-9">
                    {suggestions.map((a) => (
                      <Link key={a.href} href={a.href}>
                        <button className="text-xs border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1">
                          {a.label}
                          <ChevronRight className="h-3 w-3 opacity-60" />
                        </button>
                      </Link>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 shrink-0">
              <p className="text-[11px] text-muted-foreground mb-2">{t("support.quick_prompts_label")}</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  t("support.prompt_orders"),
                  t("support.prompt_shipping"),
                  t("support.prompt_seller"),
                  t("support.prompt_help"),
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInputText(p); textareaRef.current?.focus(); }}
                    className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground px-3 py-1.5 rounded-lg transition-colors border border-border"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t bg-card shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={t("support.input_placeholder")}
                className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] max-h-28"
                rows={1}
                disabled={sending || !conversationId}
              />
              <Button
                onClick={handleSend}
                disabled={!inputText.trim() || sending || !conversationId}
                size="icon"
                className="h-11 w-11 rounded-xl shrink-0"
              >
                {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Tickets View */}
      {view === "tickets" && (
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">{t("support.my_tickets")}</p>
              <Button variant="ghost" size="sm" onClick={fetchTickets} className="text-xs">
                <RefreshCw className="h-3.5 w-3.5 me-1.5" />
                {t("support.refresh")}
              </Button>
            </div>

            {ticketsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">{t("support.no_tickets")}</p>
                <p className="text-xs mt-1">{t("support.no_tickets_hint")}</p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <div key={ticket.id} className="border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">#{ticket.id}</span>
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {ticket.subject && (
                    <p className="text-sm text-foreground">{ticket.subject}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{ticket.category}</span>
                    {ticket.assigned_admin_name && (
                      <span>{t("support.assigned_to")}: {ticket.assigned_admin_name}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
