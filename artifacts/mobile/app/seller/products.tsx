import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { t } from "../../src/i18n";

interface SellerProduct {
  id: number;
  name: string;
  price: number;
  finalPrice: number;
  stockQuantity: number;
  imageUrls: string[];
  category: string;
  featured: boolean;
  discountPercent: number | null;
}

export default function SellerProductsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { formatPrice } = useSettings();

  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await fetch(`${getBaseUrl()}/api/sellers/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = (await r.json()) as SellerProduct[];
        setProducts(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = (id: number, name: string) => {
    Alert.alert(
      t("seller_dash.confirm_delete"),
      t("seller_dash.confirm_delete_desc"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("seller_dash.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const r = await fetch(`${getBaseUrl()}/api/sellers/products/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (r.ok) {
                setProducts((prev) => prev.filter((p) => p.id !== id));
                Alert.alert(t("seller_dash.delete_success"));
              } else {
                Alert.alert(t("seller_dash.error_delete"));
              }
            } catch {
              Alert.alert(t("seller_dash.error_delete"));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("seller_dash.my_products")}</Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/seller/products/new")}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("seller_dash.no_products")}</Text>
          <Pressable style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/seller/products/new")}>
            <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>{t("seller_dash.add_product")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              colors={colors}
              formatPrice={formatPrice}
              onEdit={() => router.push(`/seller/products/${item.id}/edit` as never)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
        />
      )}
    </View>
  );
}

function ProductRow({
  product, colors, formatPrice, onEdit, onDelete,
}: {
  product: SellerProduct;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  formatPrice: (v: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const imageUri = product.imageUrls?.[0] ?? null;
  const isLowStock = product.stockQuantity <= 5;

  return (
    <View style={[styles.productRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.productImg, { backgroundColor: colors.muted }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.productImgInner} resizeMode="cover" />
        ) : (
          <Ionicons name="cube-outline" size={24} color={colors.mutedForeground} />
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={1}>{product.name}</Text>
        <Text style={[styles.productPrice, { color: colors.primary }]}>{formatPrice(product.finalPrice ?? product.price)}</Text>
        <View style={styles.productMeta}>
          <Text style={[styles.productStock, { color: isLowStock ? "#F59E0B" : colors.mutedForeground }]}>
            {t("seller_dash.stock")}: {product.stockQuantity}
          </Text>
          {isLowStock && <Ionicons name="warning-outline" size={12} color="#F59E0B" />}
        </View>
      </View>
      <View style={styles.productActions}>
        <Pressable style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={16} color={colors.primary} />
        </Pressable>
        <Pressable style={[styles.actionBtn, { backgroundColor: "#FEF2F2" }]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 4 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  createBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  createBtnText: { fontSize: 15, fontWeight: "600" },
  productRow: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  productImg: { width: 60, height: 60, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  productImgInner: { width: 60, height: 60 },
  productInfo: { flex: 1, gap: 3 },
  productName: { fontSize: 14, fontWeight: "600" },
  productPrice: { fontSize: 14, fontWeight: "700" },
  productMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  productStock: { fontSize: 12 },
  productActions: { flexDirection: "row", gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
