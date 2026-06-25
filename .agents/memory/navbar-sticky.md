---
name: Navbar sticky architecture
description: Correct sticky header pattern for Syano marketplace and why previous fixes kept breaking it.
---

## The rule

The marketplace `<header>` in `Navbar.tsx` must be:
```tsx
<header className="sticky top-0 z-40 w-full border-b bg-background">
```

`Layout.tsx` must be:
```tsx
<div className="min-h-screen flex flex-col bg-background text-foreground">
  <Navbar />
  <main className="grow w-full min-w-0">{children}</main>
  <Footer />
</div>
```

**Why:**
- `sticky top-0` keeps the header visible during scroll (in normal flow, no overlay)
- `z-40` places it above content but below modals (z-50) and toasts (z-100+)
- `bg-background` (fully opaque) prevents content bleed-through
- `min-h-screen flex flex-col` + `grow` on main: footer sticks to bottom on short pages AND document grows beyond viewport for tall content, making window the scroll host
- `backdrop-blur bg-background/95` must NOT be used — it creates a GPU compositor layer that causes visual artifacts in proxied iframe environments

**How to apply:**
Any time the navbar appears broken (pinned, floating, scrolling away, duplicated), check these two files first and verify they match the above pattern exactly.

**Why previous fixes kept breaking it:**
- Original navbar had `sticky top-0` (correct)
- Someone added `style={{ position: "static" }}` as a bandaid — overrode sticky, broke visibility
- Task agents misread "header appears pinned/floating" as "header has fixed positioning — remove it"
- The ACTUAL original bug was `flex-1` (flex-basis:0%) on `<main>` locking document height to 100dvh so the window never scrolled, making a STATIC header look "pinned" (nothing moved)
- The correct fix for that was `flex-1` → `grow` on `<main>`, NOT removing sticky from the navbar
- `checkout.tsx` uses `sticky top-24` on its order sidebar — this value was chosen to clear the ~64px sticky header height, confirming sticky was always the intended behavior
