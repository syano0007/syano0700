import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Order } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { t } from "../src/i18n";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  processing: "#3B82F6",
  shipped: "#8B5CF6",
  delivered: "#10B981",
  cancelled: "#EF4444",
};

interface OrderCardProps {
  order: Order;
  children?: React.ReactNode;
}

export const OrderCard = React.memo(function OrderCard({ order, children }: OrderCardProps) {
  const colors = useColors();
  const statusColor = STATUS_COLORS[order.status] ?? colors.mutedForeground;

  return (
    <View
      testID="order-card"
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.orderId, { color: colors.foreground }]}>
            {t("profile.order_id", { id: String(order.id) })}
          </Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {new Date(order.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {t(`orders.status_${order.status}` as never) || order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {order.items.map((item: any) => (
        <View key={item.productId} style={styles.itemRow}>
          <Text
            style={[styles.itemName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {item.productName}
          </Text>
          <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
            ×{item.quantity} · ${item.subtotal.toFixed(2)}
          </Text>
        </View>
      ))}

      <View style={[styles.totalRow]}>
        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
          {t("cart.total")}
        </Text>
        <Text style={[styles.totalAmount, { color: colors.foreground }]}>
          ${order.total.toFixed(2)}
        </Text>
      </View>

      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderId: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  date: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  divider: {
    height: 1,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  itemMeta: {
    fontSize: 13,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "500" as const,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
});
