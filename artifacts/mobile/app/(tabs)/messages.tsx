// @refresh reset
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getConversationsQueryKey,
  useArchiveConversation,
  useGetConversations,
  useGetMessages,
  useGetTyping,
  useMarkConversationRead,
  useMuteConversation,
  useSendMessage,
  useUploadAttachment,
  type ConversationListItem,
  type ConversationMessage,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";

const BASE_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function getAttachmentUrl(convId: number, attachId: number): string {
  return `https://${BASE_DOMAIN}/api/conversations/${convId}/attachments/${attachId}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("messages.just_now");
  if (mins < 60) return t("messages.mins_ago", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("messages.hrs_ago", { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t("messages.days_ago", { n: days });
  return new Date(iso).toLocaleDateString();
}

/* ─── Typing Indicator ───────────────────────────────────────── */

function TypingDots({ colors }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.mutedForeground,
    marginHorizontal: 2,
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={styles.typingDots}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

/* ─── Attachment Display ─────────────────────────────────────── */

function AttachmentView({
  convId,
  msg,
  token,
  colors,
}: {
  convId: number;
  msg: ConversationMessage;
  token: string | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const att = msg.attachment;
  if (!att) return null;

  const isImage = att.mimeType.startsWith("image/");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  if (isImage) {
    return (
      <ExpoImage
        source={{ uri: getAttachmentUrl(convId, att.id), headers }}
        style={styles.attachmentImage}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View style={[styles.fileChip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Ionicons name="document-outline" size={16} color={colors.primary} />
      <Text style={[styles.fileChipText, { color: colors.foreground }]} numberOfLines={1}>
        {att.filename}
      </Text>
    </View>
  );
}

/* ─── Conversation Item ──────────────────────────────────────── */

const ConvItem = React.memo(function ConvItem({
  conv,
  active,
  onSelect,
  onArchive,
  onMute,
  colors,
}: {
  conv: ConversationListItem;
  active: boolean;
  onSelect: (id: number) => void;
  onArchive: (id: number) => void;
  onMute: (id: number) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const initial = conv.partnerName?.charAt(0)?.toUpperCase() ?? "?";
  const isArchived = conv.status === "archived";

  function handleLongPress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(t("messages.manage"), conv.partnerName, [
      {
        text: conv.muted ? t("messages.unmute") : t("messages.mute"),
        onPress: () => onMute(conv.id),
      },
      {
        text: isArchived ? t("messages.unarchive") : t("messages.archive"),
        onPress: () => onArchive(conv.id),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  const lastMsgText = conv.lastMessage?.hasAttachment && !conv.lastMessage.body
    ? t("messages.image_attachment")
    : conv.lastMessage?.body ?? "";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.convItem,
        {
          backgroundColor: active ? colors.accent : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      onPress={() => onSelect(conv.id)}
      onLongPress={handleLongPress}
      delayLongPress={400}
    >
      <View style={[styles.convAvatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.convAvatarText, { color: colors.primaryForeground }]}>{initial}</Text>
      </View>

      <View style={styles.convMeta}>
        <View style={styles.convRow}>
          <Text style={[styles.convName, { color: colors.foreground }]} numberOfLines={1}>
            {conv.partnerName ?? t("common.unknown")}
          </Text>
          <View style={styles.convRowEnd}>
            {conv.muted && (
              <Ionicons name="volume-mute-outline" size={12} color={colors.mutedForeground} style={{ marginEnd: 4 }} />
            )}
            <Text style={[styles.convTime, { color: colors.mutedForeground }]}>
              {timeAgo(conv.lastMessageAt)}
            </Text>
          </View>
        </View>

        {lastMsgText ? (
          <Text style={[styles.convPreview, { color: colors.mutedForeground }]} numberOfLines={1}>
            {lastMsgText}
          </Text>
        ) : null}
      </View>

      {conv.unreadCount > 0 && (
        <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.unreadText, { color: colors.primaryForeground }]}>{conv.unreadCount}</Text>
        </View>
      )}

      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
});

/* ─── Chat View ──────────────────────────────────────────────── */

function ChatView({
  conv,
  userId,
  token,
  colors,
  onBack,
}: {
  conv: ConversationListItem;
  userId: number;
  token: string | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const isInitialLoadRef = useRef(true);

  const { data: msgs, isLoading } = useGetMessages(conv.id, {
    query: { refetchInterval: 3000, queryKey: [`/api/conversations/${conv.id}/messages`] as const },
  });

  const { data: typingData } = useGetTyping(conv.id, true);
  const typingNames = typingData?.typing ?? [];

  const sendMut = useSendMessage(conv.id);
  const uploadMut = useUploadAttachment(conv.id);
  const markReadMut = useMarkConversationRead();

  useEffect(() => {
    isInitialLoadRef.current = true;
    markReadMut.mutate(conv.id);
  }, [conv.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const len = msgs?.length ?? 0;
    if (len === 0) return;
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
      return;
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [msgs?.length]);

  function handleSend() {
    const body = text.trim();
    if (!body || sendMut.isPending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText("");
    sendMut.mutate({ body });
  }

  function handleTextChange(val: string) {
    setText(val);
  }

  async function handleAttach() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.error"), t("messages.permission_denied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;

    const fileSize = asset.fileSize ?? Math.round(asset.base64.length * 0.75);
    if (fileSize > 2 * 1024 * 1024) {
      Alert.alert(t("common.error"), t("messages.file_too_large"));
      return;
    }

    const mimeType = asset.mimeType ?? "image/jpeg";
    const filename = asset.fileName ?? `photo_${Date.now()}.jpg`;

    setIsUploading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    uploadMut.mutate(
      { filename, mimeType, size: fileSize, data: asset.base64 },
      {
        onSuccess: (att: any) => {
          sendMut.mutate({ body: "", attachmentId: att.id });
          setIsUploading(false);
        },
        onError: () => {
          setIsUploading(false);
          Alert.alert(t("common.error"), t("messages.upload_failed"));
        },
      }
    );
  }

  const isBlocked = conv.status === "blocked";

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.chatContainer, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      {/* Header */}
      <Pressable
        style={[styles.chatHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
        onPress={onBack}
      >
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
        <Text style={[styles.chatHeaderBack, { color: colors.primary }]}>{t("messages.back")}</Text>
        <Text style={[styles.chatHeaderName, { color: colors.foreground }]} numberOfLines={1}>
          {conv.partnerName}
        </Text>
        {conv.muted && (
          <Ionicons name="volume-mute-outline" size={14} color={colors.mutedForeground} style={{ marginStart: 4 }} />
        )}
      </Pressable>

      {/* Blocked banner */}
      {isBlocked && (
        <View style={[styles.blockedBanner, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "44" }]}>
          <Ionicons name="ban-outline" size={14} color={colors.destructive} />
          <Text style={[styles.blockedText, { color: colors.destructive }]}>
            This conversation has been blocked
          </Text>
        </View>
      )}

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={msgs ?? []}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.msgList}
        removeClippedSubviews={true}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        updateCellsBatchingPeriod={16}
        windowSize={21}
        renderItem={({ item: m }) => <MessageBubble m={m} convId={conv.id} userId={userId} token={token} colors={colors} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
          </View>
        }
      />

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <View style={[styles.typingRow, { borderTopColor: colors.border }]}>
          <TypingDots colors={colors} />
          <Text style={[styles.typingLabel, { color: colors.mutedForeground }]}>
            {t("messages.typing", { name: typingNames[0] })}
          </Text>
        </View>
      )}

      {/* Composer */}
      {!isBlocked && (
        <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable
            style={({ pressed }) => [
              styles.attachBtn,
              { backgroundColor: colors.muted, opacity: pressed || isUploading ? 0.6 : 1 },
            ]}
            onPress={handleAttach}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="image-outline" size={20} color={colors.primary} />
            )}
          </Pressable>

          <TextInput
            style={[
              styles.input,
              { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border },
            ]}
            placeholder={t("messages.type_message")}
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />

          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor:
                  text.trim() && !sendMut.isPending ? colors.primary : colors.muted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={handleSend}
            disabled={!text.trim() || sendMut.isPending}
          >
            <Ionicons name="send" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────── */

const MessageBubble = React.memo(function MessageBubble({
  m,
  convId,
  userId,
  token,
  colors,
}: {
  m: ConversationMessage;
  convId: number;
  userId: number;
  token: string | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const mine = m.senderId === userId;
  const isDeleted = !!m.deletedAt;

  if (isDeleted) {
    return (
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <View
          style={[
            styles.deletedBubble,
            { borderColor: colors.border, backgroundColor: colors.muted + "66" },
          ]}
        >
          <Text style={[styles.deletedText, { color: colors.mutedForeground }]}>
            {t("messages.message_deleted")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      {!mine && (
        <Text style={[styles.senderLabel, { color: colors.mutedForeground }]}>{m.senderName}</Text>
      )}

      {/* Attachment */}
      {m.attachment && (
        <View style={[styles.attachWrapper, mine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
          <AttachmentView convId={convId} msg={m} token={token} colors={colors} />
        </View>
      )}

      {/* Text body */}
      {m.body ? (
        <Text
          style={[
            styles.bubbleText,
            styles.bubblePad,
            {
              backgroundColor: mine ? colors.primary : colors.card,
              color: mine ? colors.primaryForeground : colors.foreground,
              borderColor: mine ? "transparent" : colors.border,
              borderTopStartRadius: mine ? 16 : 4,
              borderTopEndRadius: mine ? 4 : 16,
            },
          ]}
        >
          {m.body}
        </Text>
      ) : null}

      {/* Time + read receipt */}
      <View style={[styles.bubbleMeta, mine ? styles.bubbleMetaMine : styles.bubbleMetaTheirs]}>
        <Text style={[styles.bubbleTime, { color: colors.mutedForeground }]}>{timeAgo(m.createdAt)}</Text>
        {mine && (
          <Ionicons
            name={m.readAt ? "checkmark-done" : "checkmark"}
            size={13}
            color={m.readAt ? colors.primary : colors.mutedForeground}
            style={{ marginStart: 3 }}
          />
        )}
      </View>
    </View>
  );
});

/* ─── Messages Screen ────────────────────────────────────────── */

type FilterTab = "all" | "unread" | "archived";

export default function MessagesScreen() {
  const colors = useColors();
  const { topPad, tabBarHeight } = useScreenLayout();
  const { user, token, isAuthenticated } = useAuth();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  const archiveMut = useArchiveConversation();
  const muteMut = useMuteConversation();

  const { data: convs, isLoading } = useGetConversations({
    query: {
      enabled: isAuthenticated && filter !== "archived",
      queryKey: getConversationsQueryKey(),
      refetchInterval: 5000,
      refetchIntervalInBackground: false,
    },
  });

  const { data: archivedConvs, isLoading: archivedLoading } = useGetConversations({
    archived: true,
    query: {
      enabled: isAuthenticated && filter === "archived",
      queryKey: getConversationsQueryKey(true),
      refetchInterval: 10_000,
    },
  });

  const source = filter === "archived" ? (archivedConvs ?? []) : (convs ?? []);
  const displayList = filter === "unread" ? source.filter((c: any) => c.unreadCount > 0) : source;

  const activeConv = [...(convs ?? []), ...(archivedConvs ?? [])].find((c) => c.id === activeConvId) ?? null;

  const handleSelectConv = useCallback((id: number) => setActiveConvId(id), []);
  const handleArchive = useCallback((id: number) => archiveMut.mutate(id), [archiveMut]);
  const handleMute = useCallback((id: number) => muteMut.mutate(id), [muteMut]);

  const renderConvItem = useCallback(
    ({ item: c }: { item: ConversationListItem }) => (
      <ConvItem
        conv={c}
        active={c.id === activeConvId}
        onSelect={handleSelectConv}
        onArchive={handleArchive}
        onMute={handleMute}
        colors={colors}
      />
    ),
    [activeConvId, handleSelectConv, handleArchive, handleMute, colors]
  );

  /* ── Auth gate ── */
  if (!isAuthenticated) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingBottom: tabBarHeight },
        ]}
      >
        <Ionicons name="chatbubbles-outline" size={56} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("messages.sign_in")}</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{t("messages.sign_in_desc")}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.signInBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={[styles.signInBtnText, { color: colors.primaryForeground }]}>
            {t("messages.sign_in_btn")}
          </Text>
        </Pressable>
      </View>
    );
  }

  /* ── Chat view ── */
  if (activeConv !== null && activeConvId !== null) {
    return (
      <ChatView
        conv={activeConv}
        userId={user!.id}
        token={token}
        colors={colors}
        onBack={() => setActiveConvId(null)}
      />
    );
  }

  /* ── Conversation list ── */
  const tabs: FilterTab[] = ["all", "unread", "archived"];
  const tabLabels: Record<FilterTab, string> = {
    all: t("messages.filter_all"),
    unread: t("messages.filter_unread"),
    archived: t("messages.filter_archived"),
  };

  const isListLoading = filter === "archived" ? archivedLoading : isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("messages.title")}</Text>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            style={({ pressed }) => [
              styles.filterTab,
              {
                borderBottomWidth: filter === tab ? 2 : 0,
                borderBottomColor: colors.primary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => setFilter(tab)}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filter === tab ? colors.primary : colors.mutedForeground },
              ]}
            >
              {tabLabels[tab]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {isListLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : displayList.length === 0 ? (
        <View style={[styles.center, { paddingBottom: tabBarHeight }]}>
          <Ionicons name="chatbubbles-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {t("messages.no_conversations")}
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            {t("messages.no_conversations_hint")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: tabBarHeight + 8,
            gap: 8,
          }}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={16}
          windowSize={10}
          renderItem={renderConvItem}
        />
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: "700" as const },
  filterRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  filterTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600" as const, textAlign: "center" },
  emptySub: { fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
  signInBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  signInBtnText: { fontSize: 15, fontWeight: "600" as const },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  convAvatarText: { fontSize: 18, fontWeight: "700" as const },
  convMeta: { flex: 1, gap: 3, minWidth: 0 },
  convRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  convRowEnd: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  convName: { fontSize: 15, fontWeight: "600" as const, flex: 1 },
  convPreview: { fontSize: 12 },
  convTime: { fontSize: 11 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 11, fontWeight: "700" as const },
  chatContainer: { flex: 1 },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 52,
    borderBottomWidth: 1,
  },
  chatHeaderBack: { fontSize: 15, fontWeight: "500" as const },
  chatHeaderName: { flex: 1, fontSize: 15, fontWeight: "600" as const },
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  blockedText: { fontSize: 13 },
  msgList: { padding: 16, gap: 10, flexGrow: 1 },
  bubble: { maxWidth: "80%", gap: 3 },
  bubbleMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  senderLabel: { fontSize: 10, paddingHorizontal: 4, marginBottom: 2 },
  bubblePad: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    lineHeight: 21,
    borderWidth: 1,
    overflow: "hidden",
  },
  bubbleText: {},
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 2 },
  bubbleMetaMine: { alignSelf: "flex-end" },
  bubbleMetaTheirs: { alignSelf: "flex-start" },
  bubbleTime: { fontSize: 10 },
  deletedBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  deletedText: { fontSize: 13, fontStyle: "italic" },
  attachWrapper: { marginBottom: 2 },
  attachmentImage: {
    width: 200,
    height: 160,
    borderRadius: 12,
  },
  fileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 220,
  },
  fileChipText: { fontSize: 13, flex: 1 },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  typingDots: { flexDirection: "row", alignItems: "center" },
  typingLabel: { fontSize: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
