import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../src/i18n";

interface SupportMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface SupportTicket {
  id: number;
  status: "open" | "resolved" | "escalated";
  messages: SupportMessage[];
  createdAt: string;
}

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, isAuthenticated } = useAuth();
  const flatRef = useRef<FlatList>(null);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "chat">("list");

  const loadTickets = async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const r = await fetch(`${getBaseUrl()}/api/support/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = (await r.json()) as SupportTicket[];
        setTickets(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTickets(); }, [isAuthenticated]);

  const openTicket = async (ticket: SupportTicket) => {
    setActiveTicket(ticket);
    setMessages(ticket.messages ?? []);
    setView("chat");
  };

  const startNewTicket = () => {
    setActiveTicket(null);
    setMessages([]);
    setView("chat");
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const userMsg: SupportMessage = { id: Date.now(), role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const r = await fetch(`${getBaseUrl()}/api/support/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, ticketId: activeTicket?.id ?? null }),
      });
      if (r.ok) {
        const data = (await r.json()) as { ticketId: number; reply: string; escalated?: boolean };
        if (!activeTicket) {
          const newTicket: SupportTicket = { id: data.ticketId, status: "open", messages: [], createdAt: new Date().toISOString() };
          setActiveTicket(newTicket);
        }
        const aiMsg: SupportMessage = { id: Date.now() + 1, role: "assistant", content: data.escalated ? t("support.escalated") : data.reply, createdAt: new Date().toISOString() };
        setMessages((prev) => [...prev, aiMsg]);
        void loadTickets();
      }
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 2, role: "assistant", content: "Sorry, something went wrong.", createdAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="chatbubble-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to access support</Text>
        <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(auth)/login")}>
          <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (view === "chat") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Chat Header */}
        <View style={[styles.chatHeader, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setView("list")} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
          <View style={styles.chatHeaderInfo}>
            <View style={[styles.agentAvatar, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 14 }}>S</Text>
            </View>
            <View>
              <Text style={[styles.agentName, { color: colors.foreground }]}>{t("support.ai_support")}</Text>
              <Text style={[styles.agentStatus, { color: "#10B981" }]}>● Online</Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.role === "user"
                ? { alignSelf: "flex-end", backgroundColor: colors.primary }
                : { alignSelf: "flex-start", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
            ]}>
              <Text style={{ color: item.role === "user" ? colors.primaryForeground : colors.foreground, fontSize: 14, lineHeight: 20 }}>
                {item.content}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.chatEmpty}>
              <Ionicons name="chatbubble-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.chatEmptyText, { color: colors.mutedForeground }]}>
                How can we help you today?
              </Text>
            </View>
          }
        />

        {/* Input */}
        <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={input}
            onChangeText={setInput}
            placeholder={t("support.type_here")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: input.trim() ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={sendMessage}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Ionicons name="send" size={18} color={input.trim() ? colors.primaryForeground : colors.mutedForeground} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* List Header */}
      <View style={[styles.listHeader, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.listTitle, { color: colors.foreground }]}>{t("support.title")}</Text>
        <Pressable
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={startNewTicket}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : tickets.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubble-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("support.no_tickets")}</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{t("support.no_tickets_desc")}</Text>
          <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={startNewTicket}>
            <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>{t("support.new_ticket")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.ticketItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => openTicket(item)}
            >
              <View style={[styles.ticketIcon, { backgroundColor: item.status === "open" ? "#3B82F622" : "#10B98122" }]}>
                <Ionicons name="chatbubble-outline" size={20} color={item.status === "open" ? "#3B82F6" : "#10B981"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ticketTitle, { color: colors.foreground }]}>
                  {t("support.title")} #{item.id}
                </Text>
                <Text style={[styles.ticketDate, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: item.status === "open" ? "#3B82F622" : "#10B98122" }]}>
                <Text style={[styles.statusText, { color: item.status === "open" ? "#3B82F6" : "#10B981" }]}>
                  {item.status === "open" ? t("support.status_open") : t("support.status_resolved")}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  listHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  listTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 4 },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center" },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  ticketItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  ticketIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ticketTitle: { fontSize: 14, fontWeight: "600" },
  ticketDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "600" },
  // Chat
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  chatHeaderInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  agentAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  agentName: { fontSize: 15, fontWeight: "700" },
  agentStatus: { fontSize: 11 },
  messageBubble: { maxWidth: "80%", padding: 12, borderRadius: 16 },
  chatEmpty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  chatEmptyText: { fontSize: 15 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderTopWidth: 1 },
  textInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
