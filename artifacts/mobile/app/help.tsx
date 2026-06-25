import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t, getLocale } from "../src/i18n";

interface FaqEntry { q: string; a: string }

function FaqItem({ q, a, colors }: FaqEntry & { colors: ReturnType<typeof useColors> }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.faqItem, { borderBottomColor: colors.border }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.faqHeader}>
        <Text style={[styles.faqQ, { color: colors.foreground }]}>{q}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open && (
        <Text style={[styles.faqA, { color: colors.mutedForeground }]}>{a}</Text>
      )}
    </View>
  );
}

const FAQ_EN = {
  orders: [
    { q: "How do I track my order?", a: "Go to the Orders tab in your account. Each order shows its current status and tracking information." },
    { q: "Can I cancel an order?", a: "You can cancel a pending order from the order detail page before the seller confirms it." },
    { q: "What happens after I place an order?", a: "The seller receives a notification and will confirm your order and arrange delivery." },
    { q: "How long does delivery take?", a: "Delivery usually takes 1-3 business days within Aleppo, or 3-7 days for other cities." },
    { q: "What if my order is wrong?", a: "Contact the seller directly through the messaging system, or reach out to our support team." },
  ],
  payments: [
    { q: "How do I pay for my order?", a: "SYANO currently supports Cash on Delivery (COD). You pay when the order arrives at your door." },
    { q: "Is cash on delivery safe?", a: "Yes. You only pay after you receive and inspect your order. Your money is safe." },
    { q: "Are there any extra fees?", a: "A delivery fee may apply depending on your location and the seller's zone. It will be shown at checkout." },
    { q: "Can I get a receipt?", a: "Order confirmations are sent to your account. You can view all order details in the Orders tab." },
  ],
  shipping: [
    { q: "Which cities do you deliver to?", a: "We currently serve Aleppo and surrounding areas, with expansion to more Syrian cities planned." },
    { q: "How are delivery fees calculated?", a: "Fees are based on your delivery zone within Aleppo. The exact fee is shown at checkout." },
    { q: "Who are your couriers?", a: "We use our own verified courier network to ensure reliable and safe deliveries." },
    { q: "Can I choose a delivery time?", a: "You can add delivery notes at checkout with any timing preferences for the courier." },
  ],
  returns: [
    { q: "What is your returns policy?", a: "Items can be returned within 7 days if they arrive damaged, defective, or not as described." },
    { q: "How do I start a return?", a: "Contact the seller through the app messaging system or reach our support team." },
    { q: "How long do refunds take?", a: "Since we use cash on delivery, refunds are arranged directly with the seller or courier." },
    { q: "What items can't be returned?", a: "Perishable items, custom orders, and items marked as non-returnable cannot be returned." },
  ],
  account: [
    { q: "How do I become a seller?", a: "Go to Profile → Become a Seller and fill out the application form. We review applications within 24-48 hours." },
    { q: "I forgot my password — what do I do?", a: "Use the 'Forgot password' link on the login screen to reset your password via email." },
    { q: "How do I update my profile?", a: "Go to Profile → Settings to update your information, language, and display currency." },
    { q: "Can I have multiple accounts?", a: "No. Each person should have only one SYANO account. Multiple accounts may be suspended." },
  ],
};

const FAQ_AR = {
  orders: [
    { q: "كيف أتابع طلبي؟", a: "انتقل إلى تبويب الطلبات في حسابك. يعرض كل طلب حالته الحالية ومعلومات التتبع." },
    { q: "هل يمكنني إلغاء طلب؟", a: "يمكنك إلغاء طلب معلق من صفحة تفاصيل الطلب قبل أن يؤكده البائع." },
    { q: "ماذا يحدث بعد تقديم الطلب؟", a: "يتلقى البائع إشعاراً وسيؤكد طلبك ويرتب التوصيل." },
    { q: "كم من الوقت يستغرق التوصيل؟", a: "يستغرق التوصيل عادة 1-3 أيام عمل داخل حلب، أو 3-7 أيام للمدن الأخرى." },
    { q: "ماذا لو كان طلبي خاطئاً؟", a: "تواصل مع البائع مباشرة من خلال نظام المراسلة، أو تواصل مع فريق الدعم." },
  ],
  payments: [
    { q: "كيف أدفع ثمن طلبي؟", a: "تدعم سيانو حالياً الدفع عند الاستلام (COD). تدفع عند وصول الطلب إلى بابك." },
    { q: "هل الدفع عند الاستلام آمن؟", a: "نعم. أنت تدفع فقط بعد استلام طلبك وفحصه. أموالك بأمان." },
    { q: "هل توجد رسوم إضافية؟", a: "قد تُطبق رسوم توصيل حسب موقعك ومنطقة البائع. ستظهر عند الدفع." },
    { q: "هل يمكنني الحصول على إيصال؟", a: "تأكيدات الطلب محفوظة في حسابك. يمكنك عرض جميع تفاصيل الطلب في تبويب الطلبات." },
  ],
  shipping: [
    { q: "ما المدن التي توصّلون إليها؟", a: "نخدم حالياً حلب والمناطق المحيطة بها، مع خطط للتوسع لمدن سورية أخرى." },
    { q: "كيف يتم احتساب رسوم التوصيل؟", a: "تعتمد الرسوم على منطقة توصيلك داخل حلب. الرسوم الدقيقة تظهر عند الدفع." },
    { q: "من هم مندوبو التوصيل؟", a: "نستخدم شبكة مندوبين موثوقين للتأكد من عمليات توصيل موثوقة وآمنة." },
    { q: "هل يمكنني اختيار وقت التوصيل؟", a: "يمكنك إضافة ملاحظات التوصيل عند الدفع مع أي تفضيلات زمنية للمندوب." },
  ],
  returns: [
    { q: "ما هي سياسة الإرجاع؟", a: "يمكن إرجاع البضائع خلال 7 أيام إذا وصلت تالفة أو معيبة أو غير مطابقة للوصف." },
    { q: "كيف أبدأ عملية الإرجاع؟", a: "تواصل مع البائع عبر نظام المراسلة في التطبيق أو تواصل مع فريق الدعم." },
    { q: "كم تستغرق استرداد المبالغ؟", a: "نظراً لاستخدام الدفع عند الاستلام، تُرتَّب المبالغ المستردة مباشرة مع البائع أو المندوب." },
    { q: "ما البضائع التي لا يمكن إرجاعها؟", a: "السلع القابلة للتلف والطلبات المخصصة والمواد المصنفة على أنها غير قابلة للإرجاع." },
  ],
  account: [
    { q: "كيف أصبح بائعاً؟", a: "اذهب إلى الملف الشخصي ← كن بائعاً وأكمل نموذج الطلب. نراجع الطلبات خلال 24-48 ساعة." },
    { q: "نسيت كلمة المرور، ماذا أفعل؟", a: "استخدم رابط 'نسيت كلمة المرور' في شاشة تسجيل الدخول لإعادة تعيينها عبر البريد الإلكتروني." },
    { q: "كيف أحدّث ملفي الشخصي؟", a: "اذهب إلى الملف الشخصي ← الإعدادات لتحديث معلوماتك ولغتك وعملة العرض." },
    { q: "هل يمكنني امتلاك حسابات متعددة؟", a: "لا. يجب أن يكون لكل شخص حساب واحد فقط في سيانو. الحسابات المتعددة قد تُعلَّق." },
  ],
};

const CATEGORIES = [
  { id: "orders", icon: "bag-outline" as const, color: "#10B981" },
  { id: "payments", icon: "card-outline" as const, color: "#3B82F6" },
  { id: "shipping", icon: "car-outline" as const, color: "#8B5CF6" },
  { id: "returns", icon: "refresh-outline" as const, color: "#F59E0B" },
  { id: "account", icon: "person-outline" as const, color: "#EC4899" },
];

export default function HelpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();
  const locale = getLocale();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const faqs = locale === "ar" ? FAQ_AR : FAQ_EN;
  const catLabels: Record<string, string> = {
    orders: locale === "ar" ? "الطلبات" : "Orders",
    payments: locale === "ar" ? "المدفوعات" : "Payments",
    shipping: locale === "ar" ? "الشحن" : "Shipping",
    returns: locale === "ar" ? "الإرجاع" : "Returns",
    account: locale === "ar" ? "الحساب" : "Account",
  };

  const displayCats = activeCategory
    ? CATEGORIES.filter((c) => c.id === activeCategory)
    : CATEGORIES;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("help.title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("help.search_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable
            style={[styles.chip, { backgroundColor: !activeCategory ? colors.primary : colors.card, borderColor: !activeCategory ? colors.primary : colors.border }]}
            onPress={() => setActiveCategory(null)}
          >
            <Text style={[styles.chipText, { color: !activeCategory ? "#fff" : colors.foreground }]}>
              {locale === "ar" ? "الكل" : "All"}
            </Text>
          </Pressable>
          {CATEGORIES.map(({ id, icon, color }) => (
            <Pressable
              key={id}
              style={[styles.chip, { backgroundColor: activeCategory === id ? color + "22" : colors.card, borderColor: activeCategory === id ? color : colors.border }]}
              onPress={() => setActiveCategory(activeCategory === id ? null : id)}
            >
              <Ionicons name={icon} size={14} color={activeCategory === id ? color : colors.mutedForeground} />
              <Text style={[styles.chipText, { color: activeCategory === id ? color : colors.foreground }]}>
                {catLabels[id]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* FAQ sections */}
        {displayCats.map(({ id, icon, color }) => {
          let items = faqs[id as keyof typeof faqs];
          if (search.trim()) {
            items = items.filter(
              ({ q, a }) =>
                q.toLowerCase().includes(search.toLowerCase()) ||
                a.toLowerCase().includes(search.toLowerCase())
            );
          }
          if (items.length === 0) return null;
          return (
            <View key={id} style={styles.section}>
              <View style={styles.catHeader}>
                <View style={[styles.catIcon, { backgroundColor: color + "22" }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={[styles.catTitle, { color: colors.foreground }]}>{catLabels[id]}</Text>
              </View>
              <View style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {items.map((item, i) => (
                  <FaqItem key={i} {...item} colors={colors} />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipsRow: {},
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  section: { marginHorizontal: 16, marginBottom: 16 },
  catHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  catIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  catTitle: { fontSize: 15, fontWeight: "700" },
  faqCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  faqItem: { borderBottomWidth: StyleSheet.hairlineWidth },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  faqQ: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  faqA: { fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 14 },
});
