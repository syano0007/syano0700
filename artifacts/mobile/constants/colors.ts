const colors = {
  light: {
    text: "#111827",
    tint: "#059669",
    background: "#F9FAFB",
    foreground: "#111827",
    card: "#FFFFFF",
    cardForeground: "#111827",
    primary: "#059669",
    primaryForeground: "#FFFFFF",
    secondary: "#E5E7EB",
    secondaryForeground: "#111827",
    muted: "#E5E7EB",
    mutedForeground: "#4B5563",
    accent: "#ECFDF5",
    accentForeground: "#065F46",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
    border: "#E5E7EB",
    input: "#E5E7EB",
  },
  /**
   * Dark theme: matches web marketplace dark theme (index.css .dark).
   * Background #1A1A1A (HSL 0 0% 10%), Card #242424 (HSL 0 0% 14%),
   * Border #333333 (HSL 0 0% 20%). NOT pure black / AMOLED.
   * Fixed June 18 2026 — was #000000 bg / #0A0A0A card / #1A1A1A border.
   */
  dark: {
    text:                  "#F8FAFC",
    tint:                  "#10B981",
    background:            "#1A1A1A",
    foreground:            "#F8FAFC",
    card:                  "#242424",
    cardForeground:        "#F8FAFC",
    primary:               "#10B981",
    primaryForeground:     "#000000",
    secondary:             "#333333",
    secondaryForeground:   "#F8FAFC",
    muted:                 "#333333",
    mutedForeground:       "#CBD5E1",
    accent:                "#052E16",
    accentForeground:      "#6EE7B7",
    destructive:           "#EF4444",
    destructiveForeground: "#F8FAFC",
    border:                "#333333",
    input:                 "#333333",
  },
  radius: 8,
};

export default colors;
