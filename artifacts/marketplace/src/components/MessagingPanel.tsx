// @refresh reset
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageCircle, Send, ArrowLeft, ArrowRight, Search, Archive,
  BellOff, Bell, Paperclip, X, Check, CheckCheck, Trash2,
  Package, Store, ShieldAlert, MoreHorizontal, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  useGetConversations,
  getConversationsQueryKey,
  useGetMessages,
  getMessagesQueryKey,
  useSendMessage,
  useDeleteMessage,
  useArchiveConversation,
  useMuteConversation,
  useMarkConversationRead,
  useUploadAttachment,
  useGetTyping,
  sendTyping,
  type ConversationListItem,
  type ConversationMessage,
} from "@workspace/api-client-react";

/* ────────────────────────────────────────────────────────────── */
/*  Types                                                          */
/* ────────────────────────────────────────────────────────────── */

type Role = "customer" | "seller" | "admin";
type FilterTab = "all" | "unread" | "archived";

export interface MessagingPanelProps {
  role: Role;
  userId: number;
  initialConvId?: number | null;
  conversations?: ConversationListItem[];
  isLoadingConvs?: boolean;
  onConvSelect?: (id: number | null) => void;
  activeConvId?: number | null;
  setActiveConvId?: (id: number | null) => void;
}

/* ────────────────────────────────────────────────────────────── */
/*  ConvItem                                                       */
/* ────────────────────────────────────────────────────────────── */

function ConvItem({
  conv,
  active,
  userId,
  onClick,
  onArchive,
  onMute,
}: {
  conv: ConversationListItem;
  active: boolean;
  userId: number;
  onClick: () => void;
  onArchive: () => void;
  onMute: () => void;
}) {
  const { t } = useTranslation();
  const lastMsg = conv.lastMessage;
  const isMine = lastMsg?.senderId === userId;
  const isArchived = conv.status === "archived";
  const [hovered, setHovered] = useState(false);

  const preview = lastMsg
    ? lastMsg.hasAttachment && !lastMsg.body
      ? "📎 " + t("messages.attachment_label")
      : (isMine ? t("messages.you_prefix") : "") + lastMsg.body
    : null;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onClick}
        className={`w-full text-start p-3.5 rounded-xl border transition-all ${
          active
            ? "border-primary/40 bg-primary/5"
            : "border-transparent hover:bg-muted/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {conv.partnerName.charAt(0).toUpperCase()}
            </div>
            {conv.unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 bg-primary text-primary-foreground text-[9px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">
                {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "text-foreground" : "text-foreground/80"}`}>
                  {conv.partnerName}
                </span>
                {conv.muted && (
                  <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                {isArchived && (
                  <span className="text-[9px] uppercase tracking-wide bg-muted text-muted-foreground px-1 rounded shrink-0">
                    {t("messages.archived_badge")}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
              </span>
            </div>
            {preview && (
              <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? "text-foreground/70 font-medium" : "text-muted-foreground"}`}>
                {preview}
              </p>
            )}
          </div>
        </div>
      </button>

      {hovered && (
        <div className="absolute end-2 top-1/2 -translate-y-1/2 flex gap-1 bg-background/95 backdrop-blur-sm border rounded-lg p-0.5 shadow-md z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title={isArchived ? t("messages.unarchive") : t("messages.archive")}
          >
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMute(); }}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title={conv.muted ? t("messages.unmute") : t("messages.mute")}
          >
            {conv.muted
              ? <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  MessageBubble                                                  */
/* ────────────────────────────────────────────────────────────── */

function MessageBubble({
  msg,
  isMine,
  convId,
  onDelete,
}: {
  msg: ConversationMessage;
  isMine: boolean;
  convId: number;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  const isDeleted = !!msg.deletedAt;
  const hasAttachment = !!msg.attachment;
  const isImage = hasAttachment && msg.attachment!.mimeType.startsWith("image/");
  const attachUrl = hasAttachment
    ? `/api/conversations/${convId}/attachments/${msg.attachmentId}`
    : null;

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2 group`}>
      <div className={`max-w-[72%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
        {isDeleted ? (
          <div className="px-4 py-2.5 rounded-2xl bg-muted/50 border border-dashed text-sm text-muted-foreground italic">
            {t("messages.message_deleted")}
          </div>
        ) : (
          <div className="relative">
            <div
              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                isMine
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {hasAttachment && attachUrl && (
                <div className="mb-2">
                  {isImage ? (
                    <a href={attachUrl} target="_blank" rel="noreferrer">
                      <img
                        src={attachUrl}
                        alt={msg.attachment!.filename}
                        className="max-w-[220px] max-h-[180px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ) : (
                    <a
                      href={attachUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-2 text-xs underline underline-offset-2 ${isMine ? "text-primary-foreground/80" : "text-primary"}`}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {msg.attachment!.filename}
                    </a>
                  )}
                </div>
              )}
              {msg.body && <p>{msg.body}</p>}
            </div>

            {isMine && (
              <div className="absolute -start-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded-full hover:bg-muted transition-colors">
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="left" className="w-32">
                    <DropdownMenuItem
                      className="text-destructive gap-2"
                      onClick={() => onDelete(msg.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("messages.delete_message")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )}

        <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
          </span>
          {isMine && !isDeleted && (
            msg.readAt
              ? <CheckCheck className="h-3 w-3 text-primary" aria-label={t("messages.read_receipt_icon")} />
              : <Check className="h-3 w-3 text-muted-foreground" aria-label={t("messages.sent_receipt")} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  TypingIndicator                                               */
/* ────────────────────────────────────────────────────────────── */

function TypingIndicator({ names }: { names: string[] }) {
  const { t } = useTranslation();
  if (!names.length) return null;
  const name = names[0];
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground">
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
          />
        ))}
      </div>
      <span>{t("messages.user_typing", { name })}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  AttachmentPreview (before send)                               */
/* ────────────────────────────────────────────────────────────── */

function AttachmentPreview({
  file,
  preview,
  onRemove,
}: {
  file: File;
  preview: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 mb-2">
      {preview ? (
        <img src={preview} alt="preview" className="h-10 w-10 object-cover rounded" />
      ) : (
        <Paperclip className="h-5 w-5 text-muted-foreground shrink-0" />
      )}
      <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {(file.size / 1024).toFixed(0)} KB
      </span>
      <button onClick={onRemove} className="p-0.5 hover:text-destructive transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  MessageThread                                                  */
/* ────────────────────────────────────────────────────────────── */

function MessageThread({
  conv,
  userId,
  role,
}: {
  conv: ConversationListItem;
  userId: number;
  role: Role;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialLoadRef = useRef(true);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: messages = [], isLoading } = useGetMessages(conv.id, {
    query: { refetchInterval: 3000, refetchIntervalInBackground: false, queryKey: getMessagesQueryKey(conv.id) },
  });
  const { data: typingData } = useGetTyping(conv.id, true);
  const sendMut = useSendMessage(conv.id);
  const deleteMut = useDeleteMessage(conv.id);
  const uploadMut = useUploadAttachment(conv.id);
  const markReadMut = useMarkConversationRead();

  const typingNames = typingData?.typing ?? [];

  useEffect(() => { isInitialLoadRef.current = true; markReadMut.mutate(conv.id); }, [conv.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (messages.length === 0) return;
    if (isInitialLoadRef.current) { isInitialLoadRef.current = false; return; }
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [typingNames.length]);

  const handleTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTyping(conv.id).catch(() => {});
    typingTimerRef.current = setTimeout(() => {}, 3000);
  }, [conv.id]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf" && file.type !== "text/plain") {
      toast({ title: t("messages.invalid_file_type"), variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: t("messages.image_too_large"), variant: "destructive" });
      return;
    }
    setPendingFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPendingPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPendingPreview(null);
    }
  }, [t, toast]);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find(i => i.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          processFile(new File([file], "pasted-image.png", { type: file.type }));
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed && !pendingFile) return;

    let attachmentId: number | undefined;

    if (pendingFile) {
      setIsUploading(true);
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(pendingFile);
        });
        const att = await uploadMut.mutateAsync({
          filename: pendingFile.name,
          mimeType: pendingFile.type,
          size: pendingFile.size,
          data: base64,
        });
        attachmentId = att.id;
        setPendingFile(null);
        setPendingPreview(null);
      } catch {
        toast({ title: t("messages.error_send_title"), description: t("messages.error_send_desc"), variant: "destructive" });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const msgBody = trimmed;
    setBody("");
    sendMut.mutate(
      { body: msgBody || undefined, attachmentId },
      {
        onError: () => {
          setBody(msgBody);
          toast({ title: t("messages.error_send_title"), description: t("messages.error_send_desc"), variant: "destructive" });
        },
      }
    );
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const partnerRole = conv.type === "customer_admin" ? t("messages.admin_label")
    : role === "customer" ? t("messages.seller_label")
    : t("messages.customer_label");

  return (
    <div
      className={`flex flex-col h-full min-h-0 ${isDragging ? "ring-2 ring-primary ring-inset" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {conv.partnerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm">{conv.partnerName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{partnerRole}</span>
              {conv.productId && (
                <>
                  <span>·</span>
                  <Package className="h-3 w-3" />
                  <span>{t("messages.about_product")}</span>
                </>
              )}
              {conv.orderId && (
                <>
                  <span>·</span>
                  <span>{t("messages.order_context", { id: conv.orderId })}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isDragging && (
            <span className="text-xs text-primary font-medium animate-pulse">
              {t("messages.drag_drop_hint")}
            </span>
          )}
        </div>
      </div>

      {/* Messages — only this scrolls */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-0.5 min-h-0">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-48 rounded-2xl self-start" />
            <Skeleton className="h-10 w-64 rounded-2xl self-end" />
            <Skeleton className="h-10 w-40 rounded-2xl self-start" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-10">
            <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">{t("messages.no_messages")}</p>
            {!isDragging && (
              <p className="text-xs mt-1 opacity-60">{t("messages.paste_image_hint")}</p>
            )}
          </div>
        ) : (
          messages.map(m => (
            <MessageBubble
              key={m.id}
              msg={m}
              isMine={m.senderId === userId}
              convId={conv.id}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          ))
        )}
        <TypingIndicator names={typingNames} />
      </div>

      {/* Composer — always anchored at bottom */}
      <div className="p-3 border-t bg-card shrink-0">
        {pendingFile && (
          <AttachmentPreview
            file={pendingFile}
            preview={pendingPreview}
            onRemove={() => { setPendingFile(null); setPendingPreview(null); }}
          />
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl border bg-background hover:bg-muted transition-colors shrink-0 text-muted-foreground hover:text-foreground"
            title={t("messages.attach_image")}
            disabled={isUploading}
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
              e.target.value = "";
            }}
          />
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => { setBody(e.target.value); handleTyping(); }}
            onKeyDown={handleKey}
            placeholder={
              isDragging
                ? t("messages.drag_drop_hint")
                : isUploading
                ? t("messages.attachment_uploading")
                : t("messages.type_message")
            }
            className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] max-h-32 disabled:opacity-50"
            rows={1}
            disabled={isUploading}
          />
          {body.length > 1800 && (
            <span className="text-[10px] text-muted-foreground shrink-0 self-end pb-3">
              {body.length}/2000
            </span>
          )}
          <Button
            onClick={handleSend}
            disabled={(!body.trim() && !pendingFile) || sendMut.isPending || isUploading}
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  ConvSidebar                                                    */
/* ────────────────────────────────────────────────────────────── */

function ConvSidebar({
  conversations,
  isLoading,
  activeConvId,
  userId,
  onSelect,
  role,
}: {
  conversations: ConversationListItem[];
  isLoading: boolean;
  activeConvId: number | null;
  userId: number;
  onSelect: (id: number) => void;
  role: Role;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const archiveMut = useArchiveConversation();
  const muteMut = useMuteConversation();

  const archivedConvs = useGetConversations({ archived: true, query: { queryKey: ["/api/conversations", "archived"] as const, enabled: filter === "archived" } });

  const source = filter === "archived"
    ? (archivedConvs.data ?? [])
    : conversations;

  const filtered = source.filter(c => {
    const matchesSearch = !search || c.partnerName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage?.body.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || filter === "archived" ||
      (filter === "unread" && c.unreadCount > 0);
    return matchesSearch && matchesFilter;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const emptyHint = role === "customer"
    ? t("messages.no_conversations_hint")
    : role === "seller"
    ? t("messages.seller_no_conv_hint")
    : t("messages.admin_empty_hint");

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("messages.search_placeholder")}
            className="w-full rounded-lg border bg-muted/30 ps-8 pe-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {(["all", "unread", "archived"] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 text-[11px] font-medium py-1 rounded-md transition-colors ${
                filter === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab === "all" ? t("messages.filter_all")
                : tab === "unread"
                  ? `${t("messages.filter_unread")}${totalUnread > 0 ? ` (${totalUnread})` : ""}`
                  : t("messages.filter_archived")}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground px-4">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            {search ? (
              <p className="text-sm font-medium">{t("messages.no_results")}</p>
            ) : (
              <>
                <p className="text-sm font-medium">{t("messages.no_conversations")}</p>
                <p className="text-xs mt-1">{emptyHint}</p>
                {role === "customer" && (
                  <Link href="/shop">
                    <Button variant="outline" size="sm" className="mt-4 gap-1.5">
                      <Store className="h-4 w-4" /> {t("messages.browse_products")}
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        ) : (
          filtered.map(c => (
            <ConvItem
              key={c.id}
              conv={c}
              active={c.id === activeConvId}
              userId={userId}
              onClick={() => onSelect(c.id)}
              onArchive={() => archiveMut.mutate(c.id)}
              onMute={() => muteMut.mutate(c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  MessagingPanel (main export)                                   */
/* ────────────────────────────────────────────────────────────── */

export function MessagingPanel({
  role,
  userId,
  initialConvId,
}: {
  role: Role;
  userId: number;
  initialConvId?: number | null;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const [activeConvId, setActiveConvId] = useState<number | null>(initialConvId ?? null);

  const { data: conversations = [], isLoading } = useGetConversations({
    query: { refetchInterval: 5000, refetchIntervalInBackground: false, queryKey: getConversationsQueryKey() },
  });

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;

  const ArrowIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="flex-1 min-h-0 border rounded-2xl overflow-hidden bg-card">
      <div className="flex h-full">
        {/* Sidebar */}
        <div className={`w-full sm:w-80 border-e flex flex-col shrink-0 ${activeConv ? "hidden sm:flex" : "flex"}`}>
          <ConvSidebar
            conversations={conversations}
            isLoading={isLoading}
            activeConvId={activeConvId}
            userId={userId}
            onSelect={setActiveConvId}
            role={role}
          />
        </div>

        {/* Thread panel */}
        <div className={`flex-1 min-w-0 min-h-0 ${activeConv ? "flex" : "hidden sm:flex"} flex-col overflow-hidden`}>
          {activeConv ? (
            <>
              <div className="sm:hidden p-2 border-b shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveConvId(null)}
                  className="gap-1.5"
                >
                  <ArrowIcon className="h-4 w-4" />
                  {t("messages.back")}
                </Button>
              </div>
              <MessageThread conv={activeConv} userId={userId} role={role} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <MessageCircle className="h-14 w-14 mb-4 opacity-20" />
              <p className="font-semibold">{t("messages.select_conversation")}</p>
              <p className="text-sm mt-1 text-center max-w-xs">
                {t("messages.select_conversation_hint")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessagingPanel;
