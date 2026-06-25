---
name: Vite React Fast Refresh import order
description: Having import statements after executable code in a TSX file breaks Vite's React Fast Refresh, causing "Invalid hook call" + Radix UI Presence infinite loop crash.
---

## Rule
All `import` statements must appear before ANY executable code (consts, functions, etc.) in every `.tsx` / `.ts` file.

## Why
Vite's React Fast Refresh (HMR transform) statically analyses module structure. When imports are interleaved with code — e.g. some imports at lines 1-16, then module-level consts/functions at lines 18-63, then MORE imports at lines 65-71 — the transform creates an inconsistent React instance boundary. The result is the component tree sees two React copies, triggering:
- "Invalid hook call" (hooks from mismatched React copy)
- "Maximum update depth exceeded" in `@radix-ui/react-presence` (`<Presence>` component)

Both errors fire simultaneously ~35 seconds after page load (when async data arrives and state updates begin).

## How to apply
- When writing or editing any `.tsx`/`.ts` file, always place ALL `import` statements at the very top, before any `const`, `function`, `class`, `type`, or other declarations.
- Merging split imports from the same module (e.g. two separate `from "wouter"` imports) into one is good practice but not strictly required — the critical rule is: no non-import code between import blocks.
- If you ever see "Invalid hook call" + "Maximum update depth exceeded" in `<Presence>` on a specific page that was recently edited, check the file for interleaved imports immediately.
