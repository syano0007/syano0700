import React from "react";
import { Platform } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Safe fallback heights when BottomTabBarHeightContext is unavailable
 * (e.g. when expo-router/unstable-native-tabs / NativeTabs is active on iOS 26+).
 */
const FALLBACK_TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 90;

/**
 * Returns layout constants for tab screens:
 * - topPad:       padding to clear the status bar / web header
 * - tabBarHeight: actual height of the bottom tab bar (includes safe-area inset);
 *                 falls back to a sensible platform constant when the
 *                 BottomTabBarHeight React context is not present (NativeTabs path).
 * - insets:       raw safe-area insets for callers that still need them directly.
 *
 * Only call this hook from a component rendered inside the tab navigator.
 * For auth screens or full-screen modals, use useSafeAreaInsets directly.
 */
export function useScreenLayout() {
  const insets = useSafeAreaInsets();

  // Read the context value directly so we get undefined (not a thrown error)
  // when NativeTabs is active and there is no BottomTabBarHeight context.
  const contextHeight = React.useContext(BottomTabBarHeightContext);
  const tabBarHeight = contextHeight ?? FALLBACK_TAB_BAR_HEIGHT;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  return { topPad, tabBarHeight, insets };
}
