---
name: No position:fixed on mobile action bars
description: Why mobile sticky bars (position:fixed) were replaced with inline elements in the shopping flow.
---

# Avoid position:fixed for mobile action bars in this project

## The rule
Avoid `position: fixed` for primary action bars (Cart summary, Checkout nav) that are the ONLY way to trigger the action. Use inline document-flow elements as the primary control.

**Why:** In earlier versions `position: fixed` caused invisible bars or bars that appeared at document-bottom instead of viewport-bottom — likely an interaction between the flex Layout wrapper and the preview iframe. The root cause was never fully isolated.

**Exception — product detail sticky bar:** A `position: fixed bottom-0 inset-x-0 md:hidden` sticky purchase bar was added to products/[id].tsx and renders correctly. It uses `IntersectionObserver` on the inline purchase card so only one purchase UI is visible at a time. This is safe because:
1. The inline purchase card remains the primary control (the sticky bar is a secondary convenience).
2. The Layout wrapper does not apply CSS `transform` or `will-change` persistently, so `fixed` positioning is not affected.

**How to apply:**
- Cart page: add a `lg:hidden` mobile summary card inside the `flex-col lg:flex-row` container after the items div; keep the `hidden lg:block` desktop summary unchanged.
- Checkout page: show navigation buttons (Back/Continue/Place Order) with plain `flex`, not `hidden lg:flex`.
- Product detail page: sticky bar uses `fixed` and is fine — see `mobile-sticky-bar.md`.
