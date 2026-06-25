import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetSellerReviews,
  usePatchSellerReviewReply,
} from "@workspace/api-client-react";
import type { SellerReview } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../../src/i18n";

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= rating ? "star" : "star-outline"} size={12} color="#F59E0B" />
      ))}
    </View>
  );
}

export default function SellerReviewsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sellerId = user?.id ?? 0;
  const [replyModal, setReplyModal] = useState<{ reviewId: number; existing: string | null } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useGetSellerReviews(sellerId, {
    query: { enabled: sellerId > 0 },
  });
  const patchReply = usePatchSellerReviewReply(sellerId);

  const reviews = data?.reviews ?? [];

  const handleReplyOpen = (review: SellerReview) => {
    setReplyModal({ reviewId: review.id, existing: review.sellerReply ?? null });
    setReplyText(review.sellerReply ?? "");
  };

  const handleReplySubmit = async () => {
    if (!replyModal) return;
    setSubmitting(true);
    patchReply.mutate(
      { reviewId: replyModal.reviewId, reply: replyText.trim() || null },
      {
        onSuccess: () => {
          setReplyModal(null);
          void refetch();
        },
        onError: () => Alert.alert("Failed to save reply"),
        onSettled: () => setSubmitting(false),
      }
    );
  };

  const handleReplyDelete = async () => {
    if (!replyModal) return;
    setSubmitting(true);
    patchReply.mutate(
      { reviewId: replyModal.reviewId, reply: null },
      {
        onSuccess: () => { setReplyModal(null); void refetch(); },
        onError: () => Alert.alert("Failed to delete reply"),
        onSettled: () => setSubmitting(false),
      }
    );
  };

  const summary = data?.summary;
  const overallScore = summary?.overallScore ?? null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("seller_dash.reviews")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary Card */}
      {summary && (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryScore}>
            <Text style={[styles.scoreNum, { color: colors.foreground }]}>
              {overallScore != null ? overallScore.toFixed(1) : "—"}
            </Text>
            <View>
              {overallScore != null && <StarRow rating={Math.round(overallScore)} />}
              <Text style={[styles.scoreSub, { color: colors.mutedForeground }]}>{summary.total} reviews</Text>
            </View>
          </View>
          <View style={styles.summaryMeta}>
            <MiniBar label={t("store.communication")} val={summary.avgCommunication ?? 0} colors={colors} />
            <MiniBar label={t("store.shipping")} val={summary.avgShipping ?? 0} colors={colors} />
            <MiniBar label={t("store.professionalism")} val={summary.avgProfessionalism ?? 0} colors={colors} />
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : reviews.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="star-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("seller_dash.no_reviews")}</Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r: SellerReview) => String(r.id)}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }: { item: SellerReview }) => (
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.reviewTop}>
                <View style={[styles.reviewerAvatar, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.reviewerInitial, { color: colors.primary }]}>
                    {item.customerName?.charAt(0).toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewerName, { color: colors.foreground }]}>{item.customerName}</Text>
                  <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <StarRow rating={Math.round((item.communicationRating + item.shippingRating + item.professionalismRating) / 3)} />
              </View>
              {item.comment && (
                <Text style={[styles.reviewComment, { color: colors.foreground }]}>{item.comment}</Text>
              )}

              {/* Reply */}
              {item.sellerReply ? (
                <View style={[styles.replyBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                  <Text style={[styles.replyLabel, { color: colors.primary }]}>Your Reply</Text>
                  <Text style={[styles.replyText, { color: colors.foreground }]}>{item.sellerReply}</Text>
                  <Pressable onPress={() => handleReplyOpen(item)} style={styles.editReplyBtn}>
                    <Text style={[styles.editReplyText, { color: colors.primary }]}>{t("seller_dash.edit")}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[styles.replyBtn, { borderColor: colors.border }]} onPress={() => handleReplyOpen(item)}>
                  <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
                  <Text style={[styles.replyBtnText, { color: colors.primary }]}>{t("seller_dash.reply")}</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}

      {/* Reply Modal */}
      <Modal visible={!!replyModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReplyModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setReplyModal(null)} style={styles.backBtn}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("seller_dash.reply")}</Text>
              {replyModal?.existing && (
                <Pressable onPress={handleReplyDelete}>
                  <Text style={[styles.deleteText, { color: colors.destructive }]}>{t("seller_dash.reply_delete")}</Text>
                </Pressable>
              )}
            </View>
            <TextInput
              style={[styles.replyInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t("seller_dash.reply_ph")}
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoFocus
            />
            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, margin: 16 }]}
              onPress={handleReplySubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>{t("seller_dash.reply_send")}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MiniBar({ label, val, colors }: { label: string; val: number; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, width: 100 }}>{label}</Text>
      <View style={[styles.miniBarBg, { backgroundColor: colors.muted }]}>
        <View style={[styles.miniBarFill, { width: `${(val / 5) * 100}%`, backgroundColor: "#F59E0B" }]} />
      </View>
      <Text style={{ fontSize: 11, color: colors.foreground, width: 24 }}>{val.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 4 },
  summaryCard: { margin: 16, borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  summaryScore: { flexDirection: "row", alignItems: "center", gap: 12 },
  scoreNum: { fontSize: 36, fontWeight: "700" },
  scoreSub: { fontSize: 13, marginTop: 4 },
  summaryMeta: { gap: 6 },
  miniBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  reviewerInitial: { fontSize: 16, fontWeight: "700" },
  reviewerName: { fontSize: 14, fontWeight: "600" },
  reviewDate: { fontSize: 12 },
  reviewComment: { fontSize: 14, lineHeight: 20 },
  replyBox: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  replyLabel: { fontSize: 11, fontWeight: "700" },
  replyText: { fontSize: 13 },
  editReplyBtn: { alignSelf: "flex-end" },
  editReplyText: { fontSize: 12, fontWeight: "600" },
  replyBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  replyBtnText: { fontSize: 13, fontWeight: "500" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: "700", marginLeft: 4 },
  deleteText: { fontSize: 14, fontWeight: "600" },
  replyInput: { margin: 16, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 120, textAlignVertical: "top" },
  submitBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  submitBtnText: { fontSize: 16, fontWeight: "700" },
});
