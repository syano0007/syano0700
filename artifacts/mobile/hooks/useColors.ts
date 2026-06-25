import { useSettings } from "@/contexts/SettingsContext";
import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * Reads theme preference from SettingsContext (persisted to AsyncStorage)
 * rather than the raw device color scheme, so the user's in-app theme
 * selection overrides the system setting when they choose Light or Dark.
 * "System" mode still follows the device.
 */
export function useColors() {
  const { isDark } = useSettings();
  const palette =
    isDark && "dark" in colors
      ? (colors as unknown as Record<string, typeof colors.light>).dark
      : colors.light;
  return { ...palette, radius: colors.radius };
}
