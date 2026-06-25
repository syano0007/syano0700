import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetOrder,
  useGetOrderHistory,
  getBaseUrl,
} from "@workspace/api-client-react";
import type { Order, OrderItem, OrderHistoryEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import { t } from "../../../src/i18n";

const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  processing: "#8B5CF6",
  preparing: "#6366F1",
  ready_for_pickup: "#14B8A6",
  shipped: "#0EA5E9",
  out_for_delivery: "#06B6D4",
  delivered: "#10B981",
  cancelled: "#EF4444",
  delivery_failed: "#EF4444",
};

function statusLabel(status: string) {
  const k = `orders.status_${status}` as never;
  return t(k) || status.replace(/_/g, " ");
}

export default function SellerOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = parseInt(String(id), 10);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { formatPrice } = useSettings();
  const queryClient = useQueryClient();
  const [marking, setMarking] = useState(false);

  const { data: order, isLoading, refetch } = useGetOrder(orderId);
  const { data: history = [] } = useGetOrderHistory(orderId);

  const canMarkReady =
    order &&
    (order.status === "confirmed" || order.status === "processing" || order.status === "preparing");

  async function handleMarkReady() {
    if (!order) return;
    setMarking(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(
        `${getBaseUrl()}/api/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: "ready_for_pickup" }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries();
      refetch();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), t("seller_dash.mark_ready_error") || "Could not update order status");
    } finally {
      setMarking(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="receipt-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Order not found</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[order.status] ?? "#64748B";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("seller_dash.order_detail") || "Order"} #{order.id}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel(order.status)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {canMarkReady && (
          <Pressable
            style={({ pressed }) => [styles.markReadyBtn, { backgroundColor: colors.primary, opacity: pressed || marking ? 0.8 : 1 }]}
            onPress={handleMarkReady}
            disabled={marking}
          >
            {marking ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryForeground} />
                <Text style={[styles.markReadyText, { color: colors.primaryForeground }]}>
                  {t("seller_dash.fulfill") || "Mark Ready for Pickup"}
                </Text>
              </>
            )}
          </Pressable>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {t("orders.order_summary") || "Order Summary"}
          </Text>
          {(order.items ?? []).map((item: OrderItem, idx: number) => (
            <View key={idx} style={[styles.itemRow, { borderTopColor: colors.border }]}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.itemImg} resizeMode="cover" />
              ) : (
                <View style={[styles.itemImgPlaceholder, { backgroundColor: colors.muted }]}>
                  <Ionicons name="cube-outline" size={20} color={colors.mutedForeground} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
                  {item.productName}
                </Text>
                <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>
                  {t("orders.qty") || "Qty"}: {item.quantity}
                </Text>
              </View>
              <Text style={[styles.itemPrice, { color: colors.primary }]}>
                {formatPrice(item.subtotal)}
              </Text>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{t("orders.order_total")}</Text>
            <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatPrice(order.total)}</Text>
          </View>
          {order.deliveryFee != null && order.deliveryFee > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{t("orders.delivery_fee")}</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatPrice(order.deliveryFee)}</Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {t("orders.customer_info") || "Customer Info"}
          </Text>
          <InfoRow icon="person-outline" label={t("checkout.full_name")} value={order.customerName} colors={colors} />
          {order.customerPhone && (
            <InfoRow icon="call-outline" label={t("checkout.phone")} value={order.customerPhone} colors={colors} />
          )}
          <InfoRow icon="location-outline" label={t("checkout.address")} value={order.shippingAddress} colors={colors} />
          {(order.zoneNameEn || order.city) && (
            <InfoRow
              icon="map-outline"
              label={t("orders.delivery_zone")}
              value={order.zoneNameEn ?? order.city ?? ""}
              colors={colors}
            />
          )}
          {order.deliveryNotes && (
            <InfoRow icon="document-text-outline" label={t("checkout.notes")} value={order.deliveryNotes} colors={colors} />
          )}
        </View>

        {order.courierName && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {t("orders.courier_info") || "Courier Info"}
            </Text>
            <InfoRow icon="bicycle-outline" label={t("orders.courier_name")} value={order.courierName} colors={colors} />
            {order.courierPhone && (
              <InfoRow icon="call-outline" label={t("checkout.phone")} value={order.courierPhone} colors={colors} />
            )}
          </View>
        )}

        {history.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {t("orders.history") || "Order History"}
            </Text>
            {history.map((entry: OrderHistoryEntry, idx: number) => (
              <View key={idx} style={[styles.historyRow, { borderTopColor: colors.border }]}>
                <View style={[styles.historyDot, { backgroundColor: STATUS_COLOR[entry.toStatus] ?? colors.primary }]} />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyStatus, { color: colors.foreground }]}>
                    {statusLabel(entry.toStatus)}
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </Text>
                  {entry.notes && (
                    <Text style={[styles.historyNote, { color: colors.mutedForeground }]}>{entry.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.mutedForeground} style={styles.infoIcon} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "600" },
  content: { padding: 16, gap: 12 },
  markReadyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 4,
  },
  markReadyText: { fontSize: 16, fontWeight: "700" },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  itemImg: { width: 52, height: 52, borderRadius: 8 },
  itemImgPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: "600" },
  itemQty: { fontSize: 13, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "700" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1 },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoIcon: { marginTop: 2 },
  infoLabel: { fontSize: 13, width: 60 },
  infoValue: { flex: 1, fontSize: 13 },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  historyInfo: { flex: 1 },
  historyStatus: { fontSize: 14, fontWeight: "600" },
  historyDate: { fontSize: 12, marginTop: 2 },
  historyNote: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
});
