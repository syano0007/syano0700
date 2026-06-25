---
name: Product Wizard Suggested Attributes
description: Suggested Attributes moved from category selection (Step 1) to Specifications (Step 4); now clickable chips that create spec rows.
---

## Feature Summary

### What changed
Suggested Attributes relocated from Step 1 (Category Selection) to Step 4 (Specifications).

### Previous behavior
Static, read-only `Badge` components rendered below the subcategory selector in `renderStep1()`. Clicking them did nothing — purely informational.

### New behavior
Interactive clickable chip `<button>` elements rendered at the top of the Specifications `<Sec>` block in `renderStep4()`. Clicking a chip:
1. Checks for an existing spec with the same key (case-insensitive, trimmed)
2. If not found: creates a new spec row with that label pre-filled in the key field and an empty value
3. If already exists: chip appears dimmed with a check icon — click is disabled (no duplicate created)
4. The new spec row behaves identically to one created via the manual "Add Spec" button

## Architecture

### Component
All Product Wizard logic lives in a single file: `artifacts/marketplace/src/components/ProductWizard.tsx`

### State management
Specs use plain `useState` — NOT `useFieldArray`:
```typescript
const [specs, setSpecs] = useState<{ id: string; key: string; value: string }[]>([]);
const addSpec = () => setSpecs(p => [...p, { id: `sp-${Date.now()}`, key: "", value: "" }]);
const removeSpec = (id: string) => setSpecs(p => p.filter(s => s.id !== id));
const updateSpec = (id: string, f: "key" | "value", v: string) =>
  setSpecs(p => p.map(s => s.id === id ? { ...s, [f]: v } : s));
```

### Suggested attribute creation (reuses existing architecture)
```typescript
setSpecs(p => [...p, { id: `sp-${Date.now()}`, key: label, value: "" }]);
```
This is the same pattern as `addSpec()` — just pre-fills the key field.

### Duplicate prevention
```typescript
const alreadyAdded = specs.some(
  s => s.key.trim().toLowerCase() === label.trim().toLowerCase()
);
```

### Attribute label used as spec key
`label = lang === "ar" ? attr.ar : attr.en` — the human-readable display name in the current language. This is stored as the spec key. The `attr.key` field (internal slug) is only used as React `key` prop.

### CategoryAttribute shape
```typescript
interface CategoryAttribute {
  key: string;   // internal slug (e.g. "brand") — used as React key only
  en: string;    // English display name
  ar: string;    // Arabic display name
}
```
Source: `artifacts/marketplace/src/lib/categories.ts`

### selectedCategory availability
`selectedCategory` is derived at component level (line ~341):
```typescript
const selectedCategory = CATEGORIES.find(c => c.slug === selectedCategorySlug);
```
Available as closure variable in both `renderStep1()` and `renderStep4()`.

## Files Changed

### `artifacts/marketplace/src/components/ProductWizard.tsx`
**Removed:** Static suggested attributes block from `renderStep1()` (was inside the category `<Sec>` after the subcategory selector):
```jsx
{selectedCategory && selectedCategory.attributes.length > 0 && (
  <div className="p-3.5 bg-primary/5 ...">
    ...static Badge components...
  </div>
)}
```

**Added:** Interactive suggested attributes panel at the top of the Specs `<Sec>` in `renderStep4()`, before the `{specs.length === 0 ? ...}` conditional:
```jsx
{selectedCategory && selectedCategory.attributes.length > 0 && (
  <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl mb-3">
    ...clickable button chips with alreadyAdded state...
  </div>
)}
```

No other files changed. No new imports added (Check and Info were already imported).

## Create Mode Validation
- Select category → Step 1 shows NO suggested attributes
- Navigate to Step 4 → Suggested Specifications panel appears above spec list
- Click chip → spec row created with pre-filled key, empty value
- Fill value → save → data persists correctly

## Edit Mode Validation
- Load existing product with specs → Step 4 shows existing specs
- Chips for already-existing spec keys appear dimmed with check icon, click disabled
- Chips for non-existing specs remain active — clicking adds new rows
- Save/update behavior unchanged

## Duplicate Prevention Strategy
Case-insensitive, trimmed string match on `spec.key` vs localized label. If match found: chip renders as `disabled`, shows check icon, `onClick` is a no-op. Strategy is "ignore click" (not "focus existing").

## Agent Handoff

### Where Suggested Attributes are rendered
`renderStep4()` in `artifacts/marketplace/src/components/ProductWizard.tsx`, inside the `<Sec>` block for Specifications, above the spec list.

### Which component owns the feature
`ProductWizard` (single-file component). Both create and edit modes use this same component.

### How specifications are created
1. Manual: "Add Spec" button calls `addSpec()` → blank row
2. Via suggestion chip: inline `setSpecs(p => [...p, { id: \`sp-${Date.now()}\`, key: label, value: "" }])` → pre-filled key row

### Files to inspect before future modifications
- `artifacts/marketplace/src/components/ProductWizard.tsx` — everything
- `artifacts/marketplace/src/lib/categories.ts` — attribute definitions per category
- `artifacts/marketplace/src/lib/productUtils.ts` — `parseSpecsFromDescription()` utility
- `artifacts/marketplace/src/i18n/en.json` and `ar.json` — translation keys (`seller_products.suggested_attributes`, `seller_products.suggested_attributes_desc`)

### What NOT to do
- Do NOT use `useFieldArray` — specs use plain `useState`
- Do NOT create parallel spec state — single `specs` array is the source of truth
- Do NOT render suggested attributes in `renderStep1()` — they were deliberately moved out
