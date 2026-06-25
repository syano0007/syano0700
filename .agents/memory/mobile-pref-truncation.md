---
name: Mobile preference row truncation
description: Root cause and fix for Arabic/English label clipping in mobile drawer preference rows (Language/Currency/Theme).
---

## The rule
Never apply `truncate` (or `min-w-0 truncate`) to preference/settings label spans inside flex rows on mobile drawers. Let text wrap naturally instead.

## Why it breaks
In a flex row: `icon + gap + label(flex-1 min-w-0 truncate) + gap + shrink-0 buttons`

- `min-w-0` allows the flex child to shrink below its content size
- `truncate` = `overflow-hidden whitespace-nowrap text-overflow:ellipsis`
- On 320px screens, the sheet/drawer width leaves only ~65–100px for the label
- Arabic labels like "تبديل السمة" (theme toggle, ~11 chars) need ~100px at text-sm → clipped

**Affected files (fixed):**
- `Navbar.tsx` mobile SheetContent preferences — Language, Currency, Theme rows (3 spans)
- `AdminLayout.tsx` SidebarContent preferences — Language, Currency, Theme rows (3 spans)

## How to apply
When writing preference/settings rows in mobile drawers:
```tsx
// WRONG
<span className="text-sm font-medium flex-1 min-w-0 truncate">{label}</span>

// RIGHT — text wraps, min-h expands gracefully
<span className="text-sm font-medium flex-1">{label}</span>
```

Intentional truncation (user names, emails, product names, search results) is still fine with `truncate` — the key distinction is UI labels vs dynamic/user-supplied text.
