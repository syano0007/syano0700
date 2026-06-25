import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import React, { type ComponentProps, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetCart, usePlaceOrder, useGetDeliveryZones } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t, getLocale } from "../src/i18n";

type Step = 1 | 2;

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();

  const { data: cart, isLoading } = useGetCart();
  const placeOrder = usePlaceOrder();

  const { data: zones = [] } = useGetDeliveryZones();

  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  const locale = getLocale();
  const selectedZone = zones.find((z: any) => z.id === selectedZoneId) ?? null;
  const zoneName = selectedZone
    ? (locale === "ar" ? selectedZone.nameAr : selectedZone.nameEn)
    : null;

  const total = cart?.total ?? 0;
  const deliveryFee = selectedZone?.fee ?? 0;
  const grandTotal = total + deliveryFee;

  function validate() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = t("checkout.error_name");
    if (!phone.trim() || phone.trim().length < 6) errs.phone = t("checkout.error_phone");
    if (!selectedZoneId) errs.zone = t("checkout.error_zone");
    if (!address.trim()) errs.address = t("checkout.error_address");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validate()) return;
    setStep(2);
  }

  function handlePlaceOrder() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    placeOrder.mutate(
      {
        data: {
          shippingAddress: address.trim(),
          customerPhone: phone.trim(),
          city: zoneName ?? "",
          deliveryNotes: notes.trim() || undefined,
          zoneId: selectedZoneId,
        },
      },
      {
        onSuccess: async (order: any) => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({
            pathname: "/order-success",
            params: { orderId: String(order.id), total: String(order.total) },
          } as Href);
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setErrors({ submit: t("checkout.error_submit") });
        },
      }
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 }]}>
        <Ionicons name="cart-outline" size={56} color={colors.mutedForeground} />
        <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: "center" }]}>{t("cart.empty")}</Text>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>{t("common.back")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => (step === 2 ? setStep(1) : router.back())} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {step === 1 ? t("checkout.title_delivery") : t("checkout.title_confirm")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <View style={[styles.stepRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {[{ id: 1, label: t("checkout.delivery") }, { id: 2, label: t("checkout.payment") }].map((s, idx) => (
          <React.Fragment key={s.id}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                {
                  backgroundColor: step >= s.id ? colors.primary : colors.muted,
                  borderColor: step >= s.id ? colors.primary : colors.border,
                }
              ]}>
                {step > s.id
                  ? <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />
                  : <Text style={[styles.stepNum, { color: step >= s.id ? colors.primaryForeground : colors.mutedForeground }]}>{s.id}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, { color: step >= s.id ? colors.foreground : colors.mutedForeground }]}>
                {s.label}
              </Text>
            </View>
            {idx < 1 && (
              <View style={[styles.stepLine, { backgroundColor: step > s.id ? colors.primary : colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          /* Step 1: Delivery Info */
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("checkout.delivery_info")}</Text>

            <Field label={t("checkout.full_name") + " *"} error={errors.fullName}>
              <View style={[styles.inputWrap, { borderColor: errors.fullName ? "#EF4444" : colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t("checkout.full_name_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={fullName}
                  onChangeText={(v) => { setFullName(v); setErrors(e => ({ ...e, fullName: "" })); }}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  autoComplete="name"
                />
              </View>
            </Field>

            <Field label={t("checkout.phone") + " *"} error={errors.phone}>
              <View style={[styles.inputWrap, { borderColor: errors.phone ? "#EF4444" : colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="call-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  ref={phoneRef}
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t("checkout.phone_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={phone}
                  onChangeText={(v) => { setPhone(v); setErrors(e => ({ ...e, phone: "" })); }}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => addressRef.current?.focus()}
                  autoComplete="tel"
                />
              </View>
            </Field>

            {/* Delivery Zone picker */}
            <Field label={t("checkout.zone_label") + " *"} error={errors.zone}>
              <Pressable
                style={[
                  styles.inputWrap,
                  {
                    borderColor: errors.zone ? "#EF4444" : colors.border,
                    backgroundColor: colors.background,
                    justifyContent: "space-between",
                  },
                ]}
                onPress={() => setShowZonePicker(true)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <Ionicons name="navigate-outline" size={18} color={colors.mutedForeground} />
                  <Text
                    style={[styles.input, { color: zoneName ? colors.foreground : colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {zoneName ?? t("checkout.zone_placeholder")}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
              </Pressable>
              {selectedZone && (
                <View style={[
                  styles.feeChip,
                  {
                    backgroundColor: selectedZone.fee > 0 ? colors.primary + "15" : "#10B98115",
                    borderColor: selectedZone.fee > 0 ? colors.primary + "40" : "#10B98140",
                  },
                ]}>
                  <Ionicons
                    name="bicycle-outline"
                    size={13}
                    color={selectedZone.fee > 0 ? colors.primary : "#10B981"}
                  />
                  <Text style={[styles.feeChipText, { color: selectedZone.fee > 0 ? colors.primary : "#10B981" }]}>
                    {selectedZone.fee > 0
                      ? `${t("checkout.delivery_fee_label")}: $${selectedZone.fee.toFixed(2)}`
                      : t("checkout.free_delivery")}
                  </Text>
                </View>
              )}
            </Field>

            <Field label={t("checkout.address") + " *"} error={errors.address}>
              <View style={[styles.inputWrapMulti, { borderColor: errors.address ? "#EF4444" : colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="home-outline" size={18} color={colors.mutedForeground} style={{ marginTop: 2 }} />
                <TextInput
                  ref={addressRef}
                  style={[styles.inputMulti, { color: colors.foreground }]}
                  placeholder={t("checkout.address_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={address}
                  onChangeText={(v) => { setAddress(v); setErrors(e => ({ ...e, address: "" })); }}
                  multiline
                  numberOfLines={3}
                  returnKeyType="next"
                  onSubmitEditing={() => notesRef.current?.focus()}
                />
              </View>
            </Field>

            <Field label={t("checkout.notes")}>
              <View style={[styles.inputWrapMulti, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="document-text-outline" size={18} color={colors.mutedForeground} style={{ marginTop: 2 }} />
                <TextInput
                  ref={notesRef}
                  style={[styles.inputMulti, { color: colors.foreground }]}
                  placeholder={t("checkout.notes_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </Field>
          </View>
        ) : (
          /* Step 2: Review + Payment */
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("checkout.review_order")}</Text>

            {/* Items */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {cart.items.map((item: any) => (
                <View key={item.productId} style={styles.itemRow}>
                  <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>×{item.quantity}</Text>
                  <Text style={[styles.itemSubtotal, { color: colors.foreground }]}>${item.subtotal.toFixed(2)}</Text>
                </View>
              ))}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              {cart.discount > 0 && (
                <View style={styles.totalLine}>
                  <Text style={[styles.totalLineLabel, { color: colors.mutedForeground }]}>{t("cart.discount")}</Text>
                  <Text style={[styles.totalLineValue, { color: "#10B981" }]}>–${cart.discount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.totalLine}>
                <Text style={[styles.totalLineLabel, { color: colors.mutedForeground }]}>{t("checkout.delivery")}</Text>
                {deliveryFee > 0
                  ? <Text style={[styles.totalLineValue, { color: colors.foreground }]}>${deliveryFee.toFixed(2)}</Text>
                  : <Text style={[styles.totalLineValue, { color: "#10B981" }]}>{t("cart.free")}</Text>
                }
              </View>
              <View style={[styles.totalLine, { marginTop: 4 }]}>
                <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>{t("cart.total")}</Text>
                <Text style={[styles.grandTotalValue, { color: colors.foreground }]}>${grandTotal.toFixed(2)}</Text>
              </View>
            </View>

            {/* Delivery address summary */}
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 16 }]}>{t("checkout.delivery_to")}</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 4 }]}>
              <Text style={[styles.addressLine, { color: colors.foreground }]}>{fullName}</Text>
              <Text style={[styles.addressLine, { color: colors.mutedForeground }]}>{phone}</Text>
              {zoneName && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="navigate-outline" size={12} color={colors.primary} />
                  <Text style={[styles.addressLine, { color: colors.primary, fontWeight: "600" as const }]}>{zoneName}</Text>
                  {deliveryFee > 0 && (
                    <Text style={[styles.addressLine, { color: colors.mutedForeground, fontSize: 11 }]}> · ${deliveryFee.toFixed(2)}</Text>
                  )}
                </View>
              )}
              <Text style={[styles.addressLine, { color: colors.mutedForeground }]}>{address}</Text>
              {notes ? <Text style={[styles.addressLine, { color: colors.mutedForeground, fontStyle: "italic" }]}>"{notes}"</Text> : null}
            </View>

            {/* Payment method */}
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 16 }]}>{t("checkout.payment_method")}</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", gap: 12, alignItems: "center" }]}>
              <View style={[styles.codIcon, { backgroundColor: colors.primary + "22" }]}>
                <Ionicons name="cash-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.codTitle, { color: colors.foreground }]}>{t("checkout.cod")}</Text>
                <Text style={[styles.codDesc, { color: colors.mutedForeground }]}>
                  {t("checkout.cod_desc")}
                </Text>
              </View>
            </View>

            {/* Trust signals */}
            <View style={[styles.trustRow, { backgroundColor: colors.muted + "60" }]}>
              {[
                { icon: "shield-checkmark-outline", text: t("checkout.trust_secure") },
                { icon: "checkmark-circle-outline", text: t("checkout.trust_sellers") },
                { icon: "star-outline", text: t("checkout.trust_protected") },
              ].map(({ icon, text }) => (
                <View key={text} style={styles.trustItem}>
                  <Ionicons name={icon as ComponentProps<typeof Ionicons>["name"]} size={14} color={colors.primary} />
                  <Text style={[styles.trustText, { color: colors.mutedForeground }]}>{text}</Text>
                </View>
              ))}
            </View>

            {errors.submit ? (
              <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={[styles.errorText, { color: "#EF4444" }]}>{errors.submit}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Zone picker modal */}
      <Modal
        visible={showZonePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowZonePicker(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t("checkout.zone_label")}
            </Text>
            <Pressable
              onPress={() => setShowZonePicker(false)}
              style={[styles.modalClose, { backgroundColor: colors.muted }]}
            >
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>
          <FlatList
            data={zones}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            renderItem={({ item }) => {
              const name = locale === "ar" ? item.nameAr : item.nameEn;
              const isSelected = item.id === selectedZoneId;
              return (
                <Pressable
                  style={[
                    styles.zoneItem,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: isSelected ? colors.primary + "12" : "transparent",
                    },
                  ]}
                  onPress={() => {
                    setSelectedZoneId(item.id);
                    setErrors((e) => ({ ...e, zone: "" }));
                    setShowZonePicker(false);
                    void Haptics.selectionAsync();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.zoneName, { color: isSelected ? colors.primary : colors.foreground }]}>
                      {name}
                    </Text>
                    {item.fee > 0 && (
                      <Text style={[styles.zoneFee, { color: colors.mutedForeground }]}>
                        {t("checkout.delivery_fee_label")}: ${item.fee.toFixed(2)}
                      </Text>
                    )}
                    {item.fee === 0 && (
                      <Text style={[styles.zoneFee, { color: "#10B981" }]}>
                        {t("checkout.free_delivery")}
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>

      {/* Sticky bottom bar */}
      <View style={[
        styles.bottomBar,
        { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }
      ]}>
        <View style={styles.bottomSummary}>
          <Text style={[styles.bottomLabel, { color: colors.mutedForeground }]}>{t("cart.total")}</Text>
          <Text style={[styles.bottomTotal, { color: colors.foreground }]}>${grandTotal.toFixed(2)}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.primary, opacity: pressed || placeOrder.isPending ? 0.8 : 1 },
          ]}
          onPress={step === 1 ? handleNext : handlePlaceOrder}
          disabled={placeOrder.isPending}
        >
          {placeOrder.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>
                {step === 1 ? t("checkout.continue_payment") : t("checkout.place_order")}
              </Text>
              <Ionicons
                name={step === 1 ? "arrow-forward" : "checkmark-circle-outline"}
                size={20}
                color={colors.primaryForeground}
              />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: "#6B7280" }]}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" as const },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    gap: 0,
  },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { fontSize: 12, fontWeight: "700" as const },
  stepLabel: { fontSize: 11, fontWeight: "500" as const },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8, marginBottom: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700" as const, marginBottom: 4 },
  field: { gap: 4 },
  label: { fontSize: 12, fontWeight: "500" as const },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 48,
  },
  inputWrapMulti: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 72,
  },
  input: { flex: 1, fontSize: 14, padding: 0 },
  inputMulti: { flex: 1, fontSize: 14, padding: 0, minHeight: 48 },
  fieldError: { fontSize: 11, color: "#EF4444", marginTop: 2 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemName: { flex: 1, fontSize: 13 },
  itemQty: { fontSize: 12 },
  itemSubtotal: { fontSize: 13, fontWeight: "600" as const, minWidth: 60, textAlign: "right" },
  divider: { height: 1, marginVertical: 4 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLineLabel: { fontSize: 13 },
  totalLineValue: { fontSize: 13, fontWeight: "500" as const },
  grandTotalLabel: { fontSize: 15, fontWeight: "700" as const },
  grandTotalValue: { fontSize: 16, fontWeight: "700" as const },
  addressLine: { fontSize: 13, lineHeight: 20 },
  codIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  codTitle: { fontSize: 14, fontWeight: "600" as const },
  codDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  trustRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  trustItem: { alignItems: "center", gap: 4 },
  trustText: { fontSize: 10, fontWeight: "500" as const },
  feeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  feeChipText: { fontSize: 12, fontWeight: "500" as const },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" as const },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  zoneName: { fontSize: 14, fontWeight: "500" as const },
  zoneFee: { fontSize: 12, marginTop: 2 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, flex: 1 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bottomSummary: { gap: 1 },
  bottomLabel: { fontSize: 11 },
  bottomTotal: { fontSize: 20, fontWeight: "700" as const },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: { fontSize: 15, fontWeight: "700" as const },
});
