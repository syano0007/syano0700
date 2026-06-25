import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useWishlist } from "@/contexts/WishlistContext";
import { useGetNotificationCount } from "@workspace/api-client-react";
import { t } from "../../src/i18n";

function NotificationBadge({ count, colors }: { count: number; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  if (count <= 0) return null;
  return (
    <View style={{
      position: "absolute", top: -4, right: -6,
      backgroundColor: colors.destructive, borderRadius: 8,
      minWidth: 16, height: 16,
      alignItems: "center", justifyContent: "center",
      paddingHorizontal: 3,
    }}>
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
        {count > 99 ? "99+" : String(count)}
      </Text>
    </View>
  );
}

function NativeTabLayout() {
  const { isSeller, isCustomer } = useAuth();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: isSeller ? "chart.bar" : "house", selected: isSeller ? "chart.bar.fill" : "house.fill" }} />
        <Label>{isSeller ? t("nav.dashboard") : t("nav.shop")}</Label>
      </NativeTabs.Trigger>
      {!isSeller && (
        <NativeTabs.Trigger name="cart">
          <Icon sf={{ default: "cart", selected: "cart.fill" }} />
          <Label>{t("nav.cart")}</Label>
        </NativeTabs.Trigger>
      )}
      {isCustomer && (
        <NativeTabs.Trigger name="wishlist">
          <Icon sf={{ default: "heart", selected: "heart.fill" }} />
          <Label>{t("nav.wishlist")}</Label>
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="orders">
        <Icon sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }} />
        <Label>{t("nav.orders")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="messages">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>{t("nav.messages")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>{t("notifications.title")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>{t("nav.profile")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const { isSeller, isCustomer } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const notifCount = useGetNotificationCount({
    query: { refetchInterval: 30_000 },
  });
  const unread = notifCount.data?.unread ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isSeller ? t("nav.dashboard") : t("nav.shop"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name={isSeller ? "chart.bar.fill" : "house.fill"} tintColor={color} size={24} />
            ) : (
              <Feather name={isSeller ? "bar-chart-2" : "home"} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t("nav.cart"),
          tabBarButton: isSeller ? () => null : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="cart.fill" tintColor={color} size={24} />
            ) : (
              <Ionicons name="cart-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: t("nav.wishlist"),
          tabBarButton: !isCustomer ? () => null : undefined,
          tabBarBadge: wishlistCount > 0 ? wishlistCount : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="heart.fill" tintColor={color} size={24} />
            ) : (
              <Ionicons name="heart-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("nav.orders"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="list.bullet.rectangle.fill" tintColor={color} size={24} />
            ) : (
              <Feather name="list" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("nav.messages"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="message.fill" tintColor={color} size={24} />
            ) : (
              <Ionicons name="chatbubbles-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("notifications.title"),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bell.fill" tintColor={color} size={24} />
            ) : (
              <Ionicons name="notifications-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.circle.fill" tintColor={color} size={24} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
