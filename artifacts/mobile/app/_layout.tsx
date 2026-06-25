import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { WishlistProvider } from "@/contexts/WishlistContext";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function RootLayoutNav() {
  const { token } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(courier-tabs)" />
      <Stack.Screen
        name="product/[id]"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen name="checkout" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="order-success" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="order/[id]" options={{ animation: "slide_from_right" }} />
      {/* Phase M2 */}
      <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="account-suspended" options={{ gestureEnabled: false }} />
      <Stack.Screen name="seller-apply" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller-application-status" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="courier-apply" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="courier-application-status" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="support" options={{ animation: "slide_from_right" }} />
      {/* Phase M4 — Seller */}
      <Stack.Screen name="seller/products" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller/products/new" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller/products/[id]/edit" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller/orders" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller/orders/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller/analytics" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller/reviews" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller/store-settings" options={{ animation: "slide_from_right" }} />
      {/* Phase M5 — Courier */}
      <Stack.Screen name="courier/workspace" options={{ animation: "fade", headerShown: false }} />
      <Stack.Screen name="courier/dashboard" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="courier/missions" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="courier/history" options={{ animation: "slide_from_right" }} />
      {/* Phase M6 — Admin */}
      <Stack.Screen name="admin/index" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin/users" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin/orders" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin/sellers" options={{ animation: "slide_from_right" }} />
      {/* Stores + Store detail */}
      <Stack.Screen name="stores/index" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="store/[slug]" options={{ animation: "slide_from_right" }} />
      {/* Parity Finalization — New screens */}
      <Stack.Screen name="verify" options={{ animation: "fade" }} />
      <Stack.Screen name="categories" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="customer-dashboard" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="about" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="contact" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="help" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="privacy-policy" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="terms" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="returns" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="cookies" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin/courier-applications" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin/verification" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin/support" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin/delivery-missions" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin/hero-banners" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="seller/trust" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="tracking/[missionId]" options={{ animation: "slide_from_bottom", headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <AuthProvider>
                  <WishlistProvider>
                    <RootLayoutNav />
                  </WishlistProvider>
                </AuthProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
