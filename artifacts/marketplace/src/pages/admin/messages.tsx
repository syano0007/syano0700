import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageCircle, Search, Shield, User, Store, Archive,
  Ban, CheckCircle, MoreHorizontal, X,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGetAdminConversations,
  useGetMessages,
  getMessagesQueryKey,
  useSendMessage,
  useBlockConversation,
  useArchiveConversation,
  type AdminConversationItem,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Send, Check, CheckCheck, Trash2 } from "lucide-react";
import { useDeleteMessage } from "@workspace/api-client-react";

type ConvType = "all" | "customer_seller" | "customer_admin" | "seller_admin";

function ConvTypeIcon({ type }: { type: string }) {
  if (type === "customer_admin") return <Shield className="h-3.5 w-3.5 text-blue-500" />;
  if (type === "seller_admin") return <Store className="h-3.5 w-3.5 text-primary" />;
  return <User className="h-3.5 w-3.5 text-muted-foreground" />;
}

function ConvTypeBadge({ type }: { type: string }) {
  const label = type === "customer_admin" ? "Customer↔Admin"
    : type === "seller_admin" ? "Seller↔Admin"
    : "Customer↔Seller";
  const color = type === "customer_admin" ? "bg-blue-500/10 text-blue-600 border-blue-200"
    : type === "seller_admin" ? "bg-primary/10 text-primary border-primary/20"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${color}`}>
      {label}
    </span>
  );
}

function AdminConvItem({
  conv,
  active,
  onClick,
  onBlock,
  onArchive,
}: {
  conv: AdminConversationItem;
  active: boolean;
  onClick: () => void;
  onBlock: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  const isBlocked = conv.status === "blocked";
  const isArchived = conv.status === "archived";

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full text-start p-3.5 rounded-xl border transition-all ${
          active ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/50"
        } ${isBlocked ? "opacity-60" : ""}`}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {conv.customerName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold truncate">{conv.customerName}</span>
                <ConvTypeIcon type={conv.type} />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {conv.unreadCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-[9px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">
                    {conv.unreadCount}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ConvTypeBadge type={conv.type} />
              {isBlocked && (
                <span className="text-[10px] text-destructive font-medium">Blocked</span>
              )}
              {isArchived && (
                <span className="text-[10px] text-muted-foreground font-medium">Archived</span>
              )}
            </div>
            {conv.lastMessage && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {conv.lastMessage.body}
              </p>
            )}
          </div>
        </div>
      </button>

      <div className="absolute end-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg bg-background/90 border shadow-sm hover:bg-muted transition-colors">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onBlock} className={isBlocked ? "text-primary" : "text-destructive"}>
              {isBlocked ? (
                <><CheckCircle className="h-3.5 w-3.5 me-2" /> {t("messages.unblock_conversation")}</>
              ) : (
                <><Ban className="h-3.5 w-3.5 me-2" /> {t("messages.block_conversation")}</>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-3.5 w-3.5 me-2" />
              {isArchived ? t("messages.unarchive") : t("messages.archive")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function AdminThread({
  conv,
  adminId,
}: {
  conv: AdminConversationItem;
  adminId: number;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const { data: messages = [], isLoading } = useGetMessages(conv.id, {
    query: { refetchInterval: 4000, queryKey: getMessagesQueryKey(conv.id) },
  });
  const sendMut = useSendMessage(conv.id);
  const deleteMut = useDeleteMessage(conv.id);

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    sendMut.mutate(
      { body: trimmed },
      {
        onError: () => {
          setBody(trimmed);
          toast({ title: t("messages.error_send_title"), variant: "destructive" });
        },
      }
    );
  };

  const isBlocked = conv.status === "blocked";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {conv.customerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm">{conv.customerName}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ConvTypeIcon type={conv.type} />
              <ConvTypeBadge type={conv.type} />
              {conv.orderId && <span>· Order #{conv.orderId}</span>}
            </div>
          </div>
        </div>
        {isBlocked && (
          <div className="mt-2 px-3 py-1.5 bg-destructive/10 text-destructive text-xs rounded-lg">
            {t("messages.conversation_blocked")}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-48 rounded-2xl self-start" />
            <Skeleton className="h-10 w-64 rounded-2xl self-end" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
            <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">{t("messages.no_messages")}</p>
          </div>
        ) : (
          messages.map(m => {
            const isMine = m.senderId === adminId;
            const isDeleted = !!m.deletedAt;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"} group`}>
                {!isMine && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 me-2 mt-auto">
                    {m.senderName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={`max-w-[70%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  {!isMine && (
                    <span className="text-[10px] text-muted-foreground mb-0.5 ps-1">{m.senderName}</span>
                  )}
                  {isDeleted ? (
                    <div className="px-3 py-2 rounded-2xl bg-muted/50 border border-dashed text-xs text-muted-foreground italic">
                      {t("messages.message_deleted")}
                    </div>
                  ) : (
                    <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}>
                      <p>{m.body}</p>
                      {isMine && (
                        <button
                          onClick={() => deleteMut.mutate(m.id)}
                          className="absolute -start-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-muted transition-all"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "flex-row-reverse" : ""}`}>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                    </span>
                    {isMine && !isDeleted && (
                      m.readAt
                        ? <CheckCheck className="h-3 w-3 text-primary" />
                        : <Check className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t bg-card shrink-0">
        {isBlocked ? (
          <div className="text-center text-sm text-muted-foreground py-2">
            {t("messages.conversation_blocked")}
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t("messages.type_message_admin")}
              className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] max-h-32"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!body.trim() || sendMut.isPending}
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [convType, setConvType] = useState<ConvType>("all");
  const [search, setSearch] = useState("");

  const { data: allConvs = [], isLoading } = useGetAdminConversations(
    convType === "all" ? undefined : convType
  );
  const blockMut = useBlockConversation();
  const archiveMut = useArchiveConversation();

  const filtered = allConvs.filter(c =>
    !search ||
    c.customerName.toLowerCase().includes(search.toLowerCase()) ||
    c.sellerName.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage?.body.toLowerCase().includes(search.toLowerCase())
  );

  const activeConv = allConvs.find(c => c.id === activeConvId) ?? null;
  const totalUnread = allConvs.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="flex flex-col overflow-hidden bg-background text-foreground" style={{ height: "100dvh" }}>
      <Navbar />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0 min-h-0">
        <div className="flex-1 overflow-hidden flex flex-col p-4 min-h-0 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">{t("messages.admin_inbox_title")}</h1>
              {totalUnread > 0 && (
                <Badge variant="default" className="text-xs">
                  {totalUnread} {t("messages.filter_unread")}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 border rounded-2xl overflow-hidden bg-card">
            <div className="flex h-full">
              {/* Sidebar */}
              <div className={`w-full sm:w-80 border-e flex flex-col shrink-0 ${activeConv ? "hidden sm:flex" : "flex"}`}>
                <div className="p-3 border-b shrink-0 space-y-2">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder={t("messages.search_placeholder")}
                      className="w-full rounded-lg border bg-muted/30 ps-8 pe-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2">
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(["all", "customer_seller", "customer_admin", "seller_admin"] as ConvType[]).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setConvType(tab)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors border ${
                          convType === tab
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground border-transparent hover:bg-muted"
                        }`}
                      >
                        {tab === "all" ? t("messages.filter_all")
                          : tab === "customer_seller" ? "C↔S"
                          : tab === "customer_admin" ? "C↔Admin"
                          : "S↔Admin"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
                  {isLoading
                    ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
                    : filtered.length === 0
                    ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{search ? t("messages.no_results") : t("messages.admin_empty_hint")}</p>
                      </div>
                    )
                    : filtered.map(c => (
                      <AdminConvItem
                        key={c.id}
                        conv={c}
                        active={c.id === activeConvId}
                        onClick={() => setActiveConvId(c.id)}
                        onBlock={() => blockMut.mutate(c.id)}
                        onArchive={() => archiveMut.mutate(c.id)}
                      />
                    ))}
                </div>
              </div>

              {/* Thread */}
              <div className={`flex-1 min-w-0 min-h-0 ${activeConv ? "flex" : "hidden sm:flex"} flex-col overflow-hidden`}>
                {activeConv ? (
                  <>
                    <div className="sm:hidden p-2 border-b shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setActiveConvId(null)} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> {t("messages.back")}
                      </Button>
                    </div>
                    <AdminThread conv={activeConv} adminId={user?.id ?? 0} />
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                    <Shield className="h-14 w-14 mb-4 opacity-20" />
                    <p className="font-semibold">{t("messages.select_conversation")}</p>
                    <p className="text-sm mt-1 text-center max-w-xs">{t("messages.admin_empty_hint")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
