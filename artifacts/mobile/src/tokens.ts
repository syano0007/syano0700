/**
 * SYANO Mobile — Design Token System
 * Derived from the web marketplace design system (index.css + Tailwind scale).
 * All homepage components must import T and use these tokens.
 * Zero arbitrary numbers — every size/spacing/radius must reference this file.
 */

export const T = {
  /**
   * Typography scale — derived from web Tailwind text-* scale.
   * Web: text-xs=12, text-sm=14, text-base=16, text-lg=18, text-xl=20,
   *      text-2xl=24, text-3xl=30, text-4xl=36.
   * Mobile adapts for ~375–430px viewport (slight reduction from desktop scale).
   */
  font: {
    display: 26,   // Brand title "SYANO", major hero entries
    hero:    24,   // Hero tagline headline
    h1:      22,   // Section primary titles (RichSectionHeader, stat values)
    h2:      18,   // Subsection headers, large arrival card name
    h3:      16,   // Section row labels, logo initials
    bodyLg:  15,   // Prominent body (prices, order totals)
    body:    14,   // Standard body text (web text-sm = 14px)
    bodySm:  13,   // Small body — category names, chip text, subtitles
    caption: 12,   // Captions — ratings, timer chips, meta text (web text-xs)
    label:   11,   // Small labels — store stats, discount badge, verified text
    micro:   10,   // Tiny labels — floating card name, category badge
    nano:     9,   // Badge numbers, "NEW" pill text
  },

  /**
   * Spacing scale — mirrors Tailwind spacing at 1 unit = 4px.
   * Used for padding, gap, margin, and insets.
   */
  spacing: {
    xs:   4,
    sm:   8,
    md:  12,
    lg:  16,
    xl:  20,
    xxl: 24,
    xxxl: 32,
  },

  /**
   * Border radius scale — base radius is 8px (matches web --radius: .5rem).
   * Web shadcn-ui: radius-sm=4px, radius-md=6px, radius-lg=8px, radius-xl=12px.
   * Mobile scale is slightly larger for touch targets.
   */
  radius: {
    sm:   6,    // Small badges, discount chips
    md:  10,    // Inputs, search bar, filter chips, small buttons
    lg:  14,    // Store cards, section containers, product cards
    xl:  20,    // Hero banner, join section outer card
    pill: 50,   // CTA primary button (fully rounded)
    full: 999,  // Icon buttons, avatar circles
  },

  /**
   * Icon size scale — maps to Lucide/Ionicons sizes.
   * Web: icon-xs≈12, icon-sm=14, icon-md=16, icon-lg=20, icon-xl=24.
   */
  icon: {
    xs:  12,   // Inline star ratings, caption-level icons
    sm:  14,   // Small inline icons — arrows, chevrons, timer, deal cart
    md:  16,   // Standard — header button icons, ProductCard cart/heart
    lg:  20,   // Prominent — app header cart, notification bell
    xl:  24,   // Large CTA icons — storefront, bicycle, section icons
  },

  /**
   * Motion constants — for future animation layer.
   * Prepare values now; do NOT add animations yet.
   */
  motion: {
    durationFast:   150,   // Quick feedback (button press)
    durationNormal: 250,   // Standard transitions
    durationSlow:   400,   // Section enter/exit

    scaleHover: 1.02,  // Subtle lift on hover/focus
    scalePress: 0.96,  // Tactile press-down feel
  },
} as const;

export type FontToken    = typeof T.font;
export type SpacingToken = typeof T.spacing;
export type RadiusToken  = typeof T.radius;
export type IconToken    = typeof T.icon;
