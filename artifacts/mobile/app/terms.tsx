import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../src/i18n";

interface Section { title: string; content: string }

const SECTIONS_EN: Section[] = [
  { title: "Acceptance of Terms", content: "By using SYANO, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform." },
  { title: "Account Registration", content: "You must create an account to use most features of SYANO. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account." },
  { title: "Seller Terms", content: "Sellers must provide accurate information about their products, including descriptions, images, and pricing. Sellers are responsible for fulfilling orders and maintaining accurate inventory information." },
  { title: "Prohibited Activities", content: "You may not use SYANO to sell counterfeit goods, engage in fraudulent activities, harass other users, or violate any applicable laws or regulations." },
  { title: "Payment Terms", content: "SYANO currently uses a Cash on Delivery (COD) payment model. Sellers are responsible for collecting payment from customers upon delivery." },
  { title: "Returns and Refunds", content: "Returns and refunds are handled according to our Returns Policy. Sellers are expected to honor legitimate return requests within the specified timeframe." },
  { title: "Limitation of Liability", content: "SYANO is not liable for the quality or accuracy of products listed by sellers, or for any disputes between buyers and sellers. We provide the platform but are not a party to transactions." },
  { title: "Termination", content: "We reserve the right to terminate or suspend accounts that violate these terms, at our sole discretion, without prior notice." },
  { title: "Changes to Terms", content: "We may modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms." },
];

const SECTIONS_AR: Section[] = [
  { title: "قبول الشروط", content: "باستخدام سيانو، توافق على الالتزام بشروط الخدمة هذه. إذا لم توافق على هذه الشروط، يرجى عدم استخدام منصتنا." },
  { title: "تسجيل الحساب", content: "يجب إنشاء حساب لاستخدام معظم ميزات سيانو. أنت مسؤول عن الحفاظ على سرية بيانات اعتماد حسابك وعن جميع الأنشطة التي تتم تحت حسابك." },
  { title: "شروط البائع", content: "يجب على البائعين تقديم معلومات دقيقة عن منتجاتهم، بما في ذلك الأوصاف والصور والأسعار. البائعون مسؤولون عن تنفيذ الطلبات والحفاظ على معلومات المخزون الدقيقة." },
  { title: "الأنشطة المحظورة", content: "لا يجوز لك استخدام سيانو لبيع البضائع المقلدة أو الانخراط في أنشطة احتيالية أو مضايقة المستخدمين الآخرين أو انتهاك أي قوانين سارية." },
  { title: "شروط الدفع", content: "تستخدم سيانو حاليًا نموذج الدفع عند الاستلام (COD). البائعون مسؤولون عن تحصيل الدفع من العملاء عند التسليم." },
  { title: "المرتجعات والمبالغ المستردة", content: "تتم معالجة المرتجعات والمبالغ المستردة وفقًا لسياسة الإرجاع الخاصة بنا. من المتوقع أن يحترم البائعون طلبات الإرجاع المشروعة." },
  { title: "تحديد المسؤولية", content: "لا تتحمل سيانو المسؤولية عن جودة أو دقة المنتجات المدرجة من قبل البائعين، أو عن أي نزاعات بين المشترين والبائعين." },
  { title: "الإنهاء", content: "نحتفظ بالحق في إنهاء أو تعليق الحسابات التي تنتهك هذه الشروط، وفقًا لتقديرنا المنفرد، دون إشعار مسبق." },
  { title: "التغييرات في الشروط", content: "قد نعدّل هذه الشروط في أي وقت. يُعدّ الاستمرار في استخدام المنصة بعد التغييرات قبولًا للشروط الجديدة." },
];

export default function TermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();
  const locale = require("../src/i18n").getLocale() as string;
  const sections = locale === "ar" ? SECTIONS_AR : SECTIONS_EN;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("terms.title")}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>{t("terms.last_updated")}</Text>
        {sections.map((s, i) => (
          <View key={i} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{s.title}</Text>
            <Text style={[styles.sectionContent, { color: colors.mutedForeground }]}>{s.content}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  lastUpdated: { fontSize: 12, marginBottom: 4 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "700" },
  sectionContent: { fontSize: 13, lineHeight: 20 },
});
