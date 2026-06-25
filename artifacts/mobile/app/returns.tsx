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
  { title: "Return Window", content: "Items may be returned within 7 days of delivery if they arrive damaged, defective, or significantly different from the product description. After 7 days, we cannot accept returns." },
  { title: "Eligible Items", content: "Most items sold on SYANO are eligible for return if they meet the return conditions. Items must be in their original condition with all accessories and packaging where applicable." },
  { title: "Non-Returnable Items", content: "Perishable goods (food, flowers), custom or personalized orders, digital products, items marked as 'Final Sale', and items that have been used or damaged after delivery are not eligible for return." },
  { title: "How to Return", content: "To initiate a return, contact the seller directly through the SYANO messaging system. Include photos of the item showing the issue. The seller will arrange pickup or ask you to drop off the item." },
  { title: "Refund Process", content: "Since SYANO uses Cash on Delivery, refunds are arranged directly between you and the seller. Once the item is received and inspected, the refund will be processed within 3-5 business days." },
  { title: "Damaged Items", content: "If an item arrives damaged, take photos immediately and contact the seller and our support team within 24 hours of delivery. We will work with the seller to resolve the issue." },
  { title: "Wrong Item Received", content: "If you receive an item different from what you ordered, contact the seller immediately through SYANO messaging. The seller is responsible for arranging the correct item delivery at no extra cost." },
  { title: "Dispute Resolution", content: "If you cannot resolve a return issue directly with the seller, contact SYANO support at support@syano.online. We will investigate and mediate the dispute." },
];

const SECTIONS_AR: Section[] = [
  { title: "نافذة الإرجاع", content: "يمكن إرجاع البضائع خلال 7 أيام من التسليم إذا وصلت تالفة أو معيبة أو مختلفة بشكل كبير عن وصف المنتج. بعد 7 أيام، لا يمكننا قبول المرتجعات." },
  { title: "البضائع المؤهلة", content: "معظم البضائع المباعة على سيانو مؤهلة للإرجاع إذا استوفت شروط الإرجاع. يجب أن تكون البضائع في حالتها الأصلية مع جميع الملحقات والتغليف." },
  { title: "البضائع غير القابلة للإرجاع", content: "البضائع القابلة للتلف (الطعام، الزهور)، والطلبات المخصصة، والمنتجات الرقمية، والبضائع المصنفة 'بيع نهائي'، والبضائع المستخدمة أو التالفة بعد التسليم." },
  { title: "كيفية الإرجاع", content: "لبدء عملية الإرجاع، تواصل مع البائع مباشرة من خلال نظام المراسلة في سيانو. أرفق صوراً للبضاعة تُظهر المشكلة. سيرتب البائع الاستلام أو يطلب منك إيداع البضاعة." },
  { title: "عملية الاسترداد", content: "نظرًا لاستخدام سيانو الدفع عند الاستلام، تُرتَّب المبالغ المستردة مباشرة بينك وبين البائع. بعد استلام البضاعة وفحصها، ستتم معالجة الاسترداد خلال 3-5 أيام عمل." },
  { title: "البضائع التالفة", content: "إذا وصلت بضاعة تالفة، التقط صورًا فورًا وتواصل مع البائع وفريق دعم سيانو خلال 24 ساعة من التسليم." },
  { title: "استلام بضاعة خاطئة", content: "إذا استلمت بضاعة مختلفة عن طلبك، تواصل مع البائع فورًا عبر رسائل سيانو. البائع مسؤول عن ترتيب توصيل البضاعة الصحيحة دون تكلفة إضافية." },
  { title: "حل النزاعات", content: "إذا لم تتمكن من حل مشكلة الإرجاع مباشرة مع البائع، تواصل مع دعم سيانو على support@syano.online. سنتحقق من النزاع ونتوسط فيه." },
];

export default function ReturnsScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("returns.title")}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>{t("returns.last_updated")}</Text>
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
