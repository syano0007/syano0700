import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

/* ── Types ───────────────────────────────────────────────────── */

export interface AttachmentMeta {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ConversationMessage {
  id: number;
  senderId: number;
  senderName: string;
  body: string;
  attachmentId: number | null;
  attachment: AttachmentMeta | null;
  readAt: string | null;
  deletedAt: string | null;
  flagged: boolean;
  createdAt: string;
}

export interface Conversation {
  id: number;
  customerId: number;
  sellerId: number;
  productId: number | null;
  orderId: number | null;
  type: string;
  status: string;
  muted: boolean;
  lastMessageAt: string;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  productName: string | null;
  partnerName: string;
}

export interface StartConversationResponse {
  conversation: ConversationWithMessages;
  messages: ConversationMessage[];
}

export interface ConversationListItem {
  id: number;
  customerId: number;
  sellerId: number;
  productId: number | null;
  orderId: number | null;
  type: string;
  status: string;
  muted: boolean;
  partnerName: string;
  lastMessage: { body: string; senderId: number; createdAt: string; hasAttachment?: boolean } | null;
  unreadCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface AdminConversationItem {
  id: number;
  customerId: number;
  sellerId: number;
  productId: number | null;
  orderId: number | null;
  type: string;
  status: string;
  muted: boolean;
  customerName: string;
  sellerName: string;
  lastMessage: { body: string; senderId: number; createdAt: string } | null;
  unreadCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface StartConversationBody {
  sellerId: number;
  productId?: number;
  orderId?: number;
  type?: string;
}

export interface SendMessageBody {
  body?: string;
  attachmentId?: number;
}

export interface UploadAttachmentBody {
  filename: string;
  mimeType: string;
  size: number;
  data: string;
}

/* ── Start / Get Conversation ────────────────────────────────── */

export const startConversation = async (body: StartConversationBody): Promise<StartConversationResponse> =>
  customFetch<StartConversationResponse>("/api/conversations", { method: "POST", body: JSON.stringify(body) });

export function useStartConversation(
  options?: UseMutationOptions<StartConversationResponse, ErrorType<unknown>, StartConversationBody>
): UseMutationResult<StartConversationResponse, ErrorType<unknown>, StartConversationBody> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => startConversation(body),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: getConversationsQueryKey() });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

/* ── Global Unread Count ─────────────────────────────────────── */

export const getUnreadCountQueryKey = () => ["/api/conversations/unread-count"] as const;

export const getUnreadCount = async (): Promise<{ unread: number }> =>
  customFetch<{ unread: number }>("/api/conversations/unread-count", { method: "GET" });

export function useGetUnreadCount<TData = { unread: number }, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<{ unread: number }, TError, TData> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getUnreadCountQueryKey();
  const queryFn: QueryFunction<{ unread: number }> = () => getUnreadCount();
  const query = useQuery({ queryKey, queryFn, refetchInterval: 10_000, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Search Conversations ────────────────────────────────────── */

export const searchConversations = async (q: string): Promise<{ matchingConversationIds: number[] }> =>
  customFetch<{ matchingConversationIds: number[] }>(`/api/conversations/search?q=${encodeURIComponent(q)}`, { method: "GET" });

export function useSearchConversations(q: string) {
  return useQuery({
    queryKey: ["/api/conversations/search", q] as const,
    queryFn: () => searchConversations(q),
    enabled: q.length >= 2,
    staleTime: 5000,
  });
}

/* ── List Conversations ──────────────────────────────────────── */

export const getConversationsQueryKey = (archived?: boolean) =>
  archived ? ["/api/conversations", "archived"] as const : ["/api/conversations"] as const;

export const getConversations = async (archived?: boolean, options?: RequestInit): Promise<ConversationListItem[]> =>
  customFetch<ConversationListItem[]>(`/api/conversations${archived ? "?archived=true" : ""}`, { ...options, method: "GET" });

export function useGetConversations<TData = ConversationListItem[], TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<ConversationListItem[], TError, TData>; request?: RequestInit; archived?: boolean }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request, archived } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getConversationsQueryKey(archived);
  const queryFn: QueryFunction<ConversationListItem[]> = ({ signal }) =>
    getConversations(archived, { signal, ...request });
  const query = useQuery({ queryKey, queryFn, refetchInterval: 15_000, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Get Messages ────────────────────────────────────────────── */

export const getMessagesUrl = (convId: number) => `/api/conversations/${convId}/messages` as const;
export const getMessagesQueryKey = (convId: number) => [getMessagesUrl(convId)] as const;

export const getMessages = async (convId: number, options?: RequestInit): Promise<ConversationMessage[]> =>
  customFetch<ConversationMessage[]>(getMessagesUrl(convId), { ...options, method: "GET" });

export function useGetMessages<TData = ConversationMessage[], TError = ErrorType<unknown>>(
  convId: number,
  options?: { query?: UseQueryOptions<ConversationMessage[], TError, TData>; request?: RequestInit }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getMessagesQueryKey(convId);
  const queryFn: QueryFunction<ConversationMessage[]> = ({ signal }) => getMessages(convId, { signal, ...request });
  const query = useQuery({ queryKey, queryFn, enabled: !!convId, refetchInterval: 8_000, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Send Message ────────────────────────────────────────────── */

export const sendMessage = async (convId: number, body: SendMessageBody): Promise<ConversationMessage> =>
  customFetch<ConversationMessage>(`/api/conversations/${convId}/messages`, { method: "POST", body: JSON.stringify(body) });

export function useSendMessage(
  convId: number,
  options?: UseMutationOptions<ConversationMessage, ErrorType<unknown>, SendMessageBody>
): UseMutationResult<ConversationMessage, ErrorType<unknown>, SendMessageBody> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => sendMessage(convId, body),
    onSuccess: (msg, ...rest) => {
      qc.setQueryData(getMessagesQueryKey(convId), (prev: ConversationMessage[] | undefined) => [...(prev ?? []), msg]);
      qc.invalidateQueries({ queryKey: getConversationsQueryKey() });
      qc.invalidateQueries({ queryKey: getUnreadCountQueryKey() });
      options?.onSuccess?.(msg, ...rest);
    },
    ...options,
  });
}

/* ── Delete Message ──────────────────────────────────────────── */

export function useDeleteMessage(convId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (msgId: number) =>
      customFetch<{ deleted: boolean }>(`/api/conversations/${convId}/messages/${msgId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getMessagesQueryKey(convId) });
    },
  });
}

/* ── Mark Conversation as Read ───────────────────────────────── */

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convId: number) =>
      customFetch<{ read: boolean }>(`/api/conversations/${convId}/read`, { method: "PATCH", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getUnreadCountQueryKey() });
      qc.invalidateQueries({ queryKey: getConversationsQueryKey() });
    },
  });
}

/* ── Archive Conversation ────────────────────────────────────── */

export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convId: number) =>
      customFetch<{ archived: boolean }>(`/api/conversations/${convId}/archive`, { method: "PATCH", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getConversationsQueryKey() });
      qc.invalidateQueries({ queryKey: getConversationsQueryKey(true) });
    },
  });
}

/* ── Mute Conversation ───────────────────────────────────────── */

export function useMuteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convId: number) =>
      customFetch<{ muted: boolean }>(`/api/conversations/${convId}/mute`, { method: "PATCH", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getConversationsQueryKey() });
    },
  });
}

/* ── Typing Indicator ────────────────────────────────────────── */

export const sendTyping = async (convId: number): Promise<void> => {
  await customFetch<{ ok: boolean }>(`/api/conversations/${convId}/typing`, { method: "POST", body: "{}" });
};

export const getTyping = async (convId: number): Promise<{ typing: string[] }> =>
  customFetch<{ typing: string[] }>(`/api/conversations/${convId}/typing`, { method: "GET" });

export function useGetTyping(convId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["/api/conversations/typing", convId] as const,
    queryFn: () => getTyping(convId),
    enabled: enabled && !!convId,
    refetchInterval: 2000,
    staleTime: 1500,
  });
}

/* ── Upload Attachment ───────────────────────────────────────── */

export const uploadAttachment = async (convId: number, body: UploadAttachmentBody): Promise<AttachmentMeta & { createdAt: string }> =>
  customFetch<AttachmentMeta & { createdAt: string }>(`/api/conversations/${convId}/attachments`, { method: "POST", body: JSON.stringify(body) });

export function useUploadAttachment(convId: number) {
  return useMutation({
    mutationFn: (body: UploadAttachmentBody) => uploadAttachment(convId, body),
  });
}

/* ── Admin Conversations ─────────────────────────────────────── */

export const getAdminConversationsQueryKey = (type?: string) =>
  ["/api/admin/conversations", type] as const;

export const getAdminConversations = async (type?: string): Promise<AdminConversationItem[]> =>
  customFetch<AdminConversationItem[]>(`/api/admin/conversations${type ? `?type=${type}` : ""}`, { method: "GET" });

export function useGetAdminConversations(type?: string) {
  return useQuery({
    queryKey: getAdminConversationsQueryKey(type),
    queryFn: () => getAdminConversations(type),
    refetchInterval: 10_000,
  });
}

export function useStartAdminConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: number; type?: string }) =>
      customFetch<{ conversation: Conversation }>("/api/admin/conversations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getAdminConversationsQueryKey() });
    },
  });
}

export function useBlockConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convId: number) =>
      customFetch<{ blocked: boolean }>(`/api/admin/conversations/${convId}/block`, { method: "PATCH", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getAdminConversationsQueryKey() });
      qc.invalidateQueries({ queryKey: getConversationsQueryKey() });
    },
  });
}
