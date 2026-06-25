---
name: RTL flex carousel fix
description: Root cause and fix for HeroBannerCarousel breaking in Arabic (RTL) mode — CSS direction:rtl reverses flex main axis.
---

## The Rule
Any flex-based slide track must have `direction: "ltr"` explicitly set on the track element when the page supports RTL locales.

## Why
`document.documentElement.dir = "rtl"` (set by i18n `applyDirection()`) cascades CSS `direction: rtl` into all descendant flex containers. For `flex-direction: row`, this reverses the main axis — slides stack right-to-left instead of left-to-right. The `translateX(-pct%)` math then moves in the wrong direction: dot 1 shows slide N, dot N shows slide 1, swipe directions are inverted.

The bug only manifests in Arabic because English never sets `dir="rtl"`.

## How to Apply
- On the track `<div>` that holds all slides, set `style={{ direction: "ltr" }}`.
- Do NOT invert translateX, do NOT create separate RTL code paths, do NOT use flex-row-reverse.
- Remove any keyboard `isRTL ? goNext() : goPrev()` inversions — with direction:ltr on the track, the physical ArrowLeft = previous and ArrowRight = next identically in both locales.
- Text inside individual slide cells is unaffected because they inherit direction from their own content, not the track.
