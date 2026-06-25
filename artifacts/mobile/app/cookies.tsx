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
  { title: "What Are Cookies?", content: "Cookies are small text files stored on your device when you visit a website. They help us provide a better experience by remembering your preferences and login status." },
  { title: "Types of Cookies We Use", content: "We use essential cookies (required for the platform to function), preference cookies (to remember your language and theme settings), and analytics cookies (to understand how users interact with our platform)." },
  { title: "Essential Cookies", content: "These cookies are necessary for the platform to work. They enable core functions like authentication (keeping you logged in) and shopping cart functionality. You cannot opt out of essential cookies." },
  { title: "Preference Cookies", content: "These cookies remember your preferences such as language (Arabic/English), theme (dark/light), and currency display. Disabling them means your preferences won't be saved between visits." },
  { title: "Analytics Cookies", content: "We use analytics cookies to understand how visitors interact with SYANO so we can improve our platform. All data is aggregated and anonymized. You can opt out of analytics cookies." },
  { title: "Managing Cookies", content: "Since SYANO is a mobile application, cookies are managed through the app's local storage. You can clear app data through your device settings to remove all stored data." },
  { title: "Updates to This Policy", content: "We may update this cookies policy as our practices change. We will notify you of significant changes through the app." },
];

const SECTIONS_AR: Section[] = [
  { title: "ما هي ملفات تعريف الارتباط؟", content: "ملفات تعريف الارتباط هي ملفات نصية صغيرة تُخزَّن على جهازك عند زيارة موقع ويب. تساعدنا في تقديم تجربة أفضل من خلال تذكر تفضيلاتك وحالة تسجيل الدخول." },
  { title: "أنواع ملفات تعريف الارتباط التي نستخدمها", content: "نستخدم ملفات تعريف الارتباط الأساسية (المطلوبة لعمل المنصة)، وملفات تعريف ارتباط التفضيلات (لتذكر إعدادات اللغة والمظهر)، وملفات تعريف ارتباط التحليلات." },
  { title: "ملفات تعريف الارتباط الأساسية", content: "هذه الملفات ضرورية لعمل المنصة. تتيح وظائف أساسية مثل المصادقة وإبقائك مسجل الدخول ووظيفة سلة التسوق. لا يمكنك إلغاء الاشتراك في ملفات تعريف الارتباط الأساسية." },
  { title: "ملفات تعريف ارتباط التفضيلات", content: "تتذكر هذه الملفات تفضيلاتك مثل اللغة (عربي/إنجليزي) والمظهر (داكن/فاتح) وعرض العملة. يعني تعطيلها أن تفضيلاتك لن تُحفظ بين الزيارات." },
  { title: "ملفات تعريف ارتباط التحليلات", content: "نستخدم ملفات تعريف ارتباط التحليلات لفهم كيفية تفاعل الزوار مع سيانو حتى نتمكن من تحسين منصتنا. جميع البيانات مجمعة ومجهولة الهوية." },
  { title: "إدارة ملفات تعريف الارتباط", content: "نظرًا لأن سيانو تطبيق جوال، تتم إدارة ملفات تعريف الارتباط من خلال التخزين المحلي للتطبيق. يمكنك مسح بيانات التطبيق من خلال إعدادات جهازك لإزالة جميع البيانات المخزنة." },
  { title: "تحديثات هذه السياسة", content: "قد نحدّث سياسة ملفات تعريف الارتباط هذه مع تغيير ممارساتنا. سنخطرك بالتغييرات الجوهرية من خلال التطبيق." },
];

export default function CookiesScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("cookies.title")}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>{t("cookies.last_updated")}</Text>
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
