---
name: Radix Sheet/Dialog accessibility rules
description: SheetContent and DialogContent both fire console warnings unless title + aria-describedby are provided; SheetContent is built on Dialog so the same rules apply to both.
---

## The Rule

Every `<DialogContent>` and `<SheetContent>` must satisfy two Radix checks:

1. **Title** — A `<DialogTitle>` / `<SheetTitle>` must exist inside the content.
   - Visually hidden is fine: `<SheetTitle className="sr-only">Nav menu</SheetTitle>`

2. **Description** — Either a `<DialogDescription>` / `<SheetDescription>` OR `aria-describedby={undefined}` on the content element to explicitly opt out.
   - Use `<DialogContent aria-describedby={undefined}>` when there's no meaningful description to provide.

## Why

SheetContent is implemented internally using Radix's Dialog primitive, so both components share the same ARIA-enforcement logic. Omitting either check fires a console warning that pollutes logs and indicates a real screen-reader gap.

**How to apply:** Any time a new Sheet or Dialog is created, immediately add a sr-only title and either a description or `aria-describedby={undefined}`. Run the app and check console for warnings before calling the feature done.

## Pattern

```tsx
<Sheet>
  <SheetTrigger asChild><Button>Open</Button></SheetTrigger>
  <SheetContent aria-describedby={undefined}>
    <SheetTitle className="sr-only">Navigation</SheetTitle>
    {/* content */}
  </SheetContent>
</Sheet>

<Dialog>
  <DialogContent aria-describedby={undefined}>
    <DialogHeader>
      <DialogTitle>Edit Item</DialogTitle>
    </DialogHeader>
    {/* content */}
  </DialogContent>
</Dialog>
```
