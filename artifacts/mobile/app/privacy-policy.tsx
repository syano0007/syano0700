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
  {
    title: "Information We Collect",
    content: "We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This includes your name, email address, phone number, delivery address, and payment information (for COD orders, only order amounts are recorded).",
  },
  {
    title: "How We Use Your Information",
    content: "We use the information we collect to process transactions, send you order confirmations and updates, provide customer support, send promotional communications (with your consent), improve our services, and comply with legal obligations.",
  },
  {
    title: "Information Sharing",
    content: "We share your information with sellers to fulfill your orders, with couriers to deliver your orders, and with service providers who assist in our operations. We do not sell your personal information to third parties.",
  },
  {
    title: "Data Security",
    content: "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Your password is encrypted and never stored in plain text.",
  },
  {
    title: "Your Rights",
    content: "You have the right to access, correct, or delete your personal information. You may also request that we restrict processing of your data or object to certain processing activities. To exercise these rights, contact us at privacy@syano.online.",
  },
  {
    title: "Cookies",
    content: "We use cookies and similar tracking technologies to improve your experience on our platform. You can control cookies through your browser settings. Disabling cookies may affect some features of the platform.",
  },
  {
    title: "Changes to This Policy",
    content: "We may update this privacy policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the effective date.",
  },
  {
    title: "Contact Us",
    content: "If you have any questions about this privacy policy or our privacy practices, please contact us at privacy@syano.online or through our Help Center.",
  },
];

const SECTIONS_AR: Section[] = [
  {
    title: "المعلومات التي نجمعها",
    content: "نجمع المعلومات التي تقدمها لنا مباشرة، مثل عند إنشاء حساب أو إجراء عملية شراء أو التواصل معنا للدعم. يشمل ذلك اسمك وعنوان بريدك الإلكتروني ورقم هاتفك وعنوان التوصيل.",
  },
  {
    title: "كيف نستخدم معلوماتك",
    content: "نستخدم المعلومات التي نجمعها لمعالجة المعاملات، وإرسال تأكيدات الطلبات والتحديثات، وتقديم دعم العملاء، وإرسال اتصالات ترويجية (بموافقتك)، وتحسين خدماتنا.",
  },
  {
    title: "مشاركة المعلومات",
    content: "نشارك معلوماتك مع البائعين لتنفيذ طلباتك، ومع شركاء التوصيل لتوصيل طلباتك، ومع مزودي الخدمات الذين يساعدون في عملياتنا. لا نبيع معلوماتك الشخصية لأطراف ثالثة.",
  },
  {
    title: "أمان البيانات",
    content: "نطبق تدابير تقنية وتنظيمية مناسبة لحماية معلوماتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفصاح أو التدمير.",
  },
  {
    title: "حقوقك",
    content: "لديك الحق في الوصول إلى معلوماتك الشخصية أو تصحيحها أو حذفها. للممارسة هذه الحقوق، تواصل معنا على privacy@syano.online.",
  },
  {
    title: "ملفات تعريف الارتباط",
    content: "نستخدم ملفات تعريف الارتباط وتقنيات التتبع المماثلة لتحسين تجربتك. يمكنك التحكم فيها من خلال إعدادات المتصفح.",
  },
  {
    title: "التغييرات على هذه السياسة",
    content: "قد نحدّث سياسة الخصوصية هذه من وقت لآخر. سنخطرك بأي تغييرات جوهرية بنشر السياسة الجديدة على هذه الصفحة.",
  },
  {
    title: "اتصل بنا",
    content: "إذا كان لديك أي أسئلة حول سياسة الخصوصية هذه، يرجى التواصل معنا على privacy@syano.online.",
  },
];

export default function PrivacyPolicyScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("privacy.title")}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>{t("privacy.last_updated")}</Text>
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
