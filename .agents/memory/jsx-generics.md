---
name: JSX generic syntax
description: Babel in Vite rejects explicit generic type params in JSX component calls — how to work around it.
---

## Rule
Never write `<MyComponent<T> prop={...} />` in TSX files processed by Vite/Babel. Babel's JSX parser sees the `<` after the component name and tries to parse it as an attribute, crashing with "Unexpected token".

**Why:** Vite uses `@babel/parser` for HMR/JSX transforms. Unlike `tsc`, Babel does not support explicit generic instantiation in JSX open-tag position.

**How to apply:**
- Remove explicit generic type params from the JSX call.
- If the component is generic (e.g. `function Picker<T>`) — simplify to use `string` / `unknown` and narrow with a cast in `onChange`:
  ```tsx
  // ❌ Babel parse error
  <SegmentPicker<"a" | "b"> options={...} onChange={setVal} />

  // ✅ Works — cast in the callback
  <SegmentPicker options={...} onChange={(v) => setVal(v as "a" | "b")} />
  ```
- Alternatively, define the component with a concrete type (no generic) when the type set is fixed.
