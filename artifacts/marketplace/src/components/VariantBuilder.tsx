// @refresh reset
import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Zap, ImageIcon, X, Check, Pencil, Info,
  GripVertical, ChevronDown, ChevronUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// ─── Preset attribute types ────────────────────────────────────────────────────
const PRESETS = [
  {
    key: "color", icon: "🎨", name: "Color", nameAr: "اللون",
    suggestions:   ["Black","White","Gray","Silver","Gold","Blue","Red","Green","Yellow","Orange","Pink","Purple","Brown","Beige","Navy","Olive","Cream","Coral","Mint"],
    suggestionsAr: ["أسود","أبيض","رمادي","فضي","ذهبي","أزرق","أحمر","أخضر","أصفر","برتقالي","وردي","بنفسجي","بني","بيج","كحلي","زيتوني","كريمي","مرجاني","نعناعي"],
  },
  {
    key: "size", icon: "📏", name: "Size", nameAr: "المقاس",
    suggestions:   ["XS","S","M","L","XL","XXL","XXXL"],
    suggestionsAr: ["XS","S","M","L","XL","XXL","XXXL"],
  },
  {
    key: "storage", icon: "💾", name: "Storage", nameAr: "السعة",
    suggestions:   ["32GB","64GB","128GB","256GB","512GB","1TB","2TB"],
    suggestionsAr: ["32GB","64GB","128GB","256GB","512GB","1TB","2TB"],
  },
  {
    key: "ram", icon: "🧠", name: "RAM", nameAr: "الذاكرة",
    suggestions:   ["4GB","6GB","8GB","12GB","16GB","24GB","32GB"],
    suggestionsAr: ["4GB","6GB","8GB","12GB","16GB","24GB","32GB"],
  },
  {
    key: "material", icon: "🧵", name: "Material", nameAr: "الخامة",
    suggestions:   ["Cotton","Leather","Plastic","Wood","Glass","Metal","Polyester","Wool","Linen","Denim"],
    suggestionsAr: ["قطن","جلد","بلاستيك","خشب","زجاج","معدن","بوليستر","صوف","كتان","دنيم"],
  },
  {
    key: "style", icon: "✨", name: "Style", nameAr: "النمط",
    suggestions:   ["Classic","Modern","Sport","Casual","Premium","Formal","Vintage"],
    suggestionsAr: ["كلاسيكي","عصري","رياضي","كاجوال","مميز","رسمي","عتيق"],
  },
  {
    key: "model", icon: "📦", name: "Model", nameAr: "الموديل",
    suggestions:   [],
    suggestionsAr: [],
  },
  {
    key: "edition", icon: "🏷️", name: "Edition", nameAr: "الإصدار",
    suggestions:   ["Standard","Pro","Lite","Plus","Max","Ultra"],
    suggestionsAr: ["عادي","برو","لايت","بلس","ماكس","ألترا"],
  },
] as const;

type Preset = typeof PRESETS[number];

// Color name → CSS hex (EN + AR)
const COLOR_HEX: Record<string, string> = {
  black:"#1a1a1a", white:"#f8f8f8", gray:"#9ca3af", grey:"#9ca3af",
  silver:"#c4c4c4", gold:"#d97706", blue:"#3b82f6", red:"#ef4444",
  green:"#22c55e", yellow:"#eab308", orange:"#f97316", pink:"#ec4899",
  purple:"#a855f7", brown:"#78350f", navy:"#1e3a5f", teal:"#14b8a6",
  beige:"#e8dcc8", cream:"#fefce8", maroon:"#7f1d1d", olive:"#65a30d",
  coral:"#fb7185", mint:"#6ee7b7",
  أسود:"#1a1a1a", أبيض:"#f8f8f8", رمادي:"#9ca3af", فضي:"#c4c4c4",
  ذهبي:"#d97706", أزرق:"#3b82f6", أحمر:"#ef4444", أخضر:"#22c55e",
  أصفر:"#eab308", برتقالي:"#f97316", وردي:"#ec4899", بنفسجي:"#a855f7",
  بني:"#78350f", كحلي:"#1e3a5f", بيج:"#e8dcc8", كريمي:"#fefce8",
  زيتوني:"#65a30d", مرجاني:"#fb7185", نعناعي:"#6ee7b7",
};

const COLOR_GROUP_KEYS = new Set([
  "color","colour","colors","colours","اللون","الألوان","لون","ألوان",
]);

function isColorGroup(name: string) {
  return COLOR_GROUP_KEYS.has(name.toLowerCase().trim());
}
function getColorHex(value: string): string | null {
  return COLOR_HEX[value.toLowerCase().trim()] ?? COLOR_HEX[value.trim()] ?? null;
}
function findPreset(name: string): Preset | null {
  const lower = name.toLowerCase().trim();
  return (PRESETS as readonly Preset[]).find(
    p => p.name.toLowerCase() === lower || p.nameAr === name.trim() || p.key === lower,
  ) ?? null;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface AttributeGroup {
  id: string;
  name: string;
  values: string[];
  enabled?: boolean;
}

export interface VariantRow {
  id: string;
  combination: { groupName: string; value: string }[];
  label: string;
  sku: string;
  price: number | null;
  compareAtPrice: number | null;
  barcode: string;
  weightGrams: number | null;
  stock: number;
  images: string[];
  active: boolean;
}

interface VariantBuilderProps {
  groups: AttributeGroup[];
  onGroupsChange: (groups: AttributeGroup[]) => void;
  variants: VariantRow[];
  onVariantsChange: (variants: VariantRow[]) => void;
  defaultStock?: number;
  hasVariants?: boolean;
  onHasVariantsChange?: (v: boolean) => void;
}

// ─── Exported helpers (unchanged public API) ───────────────────────────────────
export function cartesianVariants(groups: AttributeGroup[], defaultStock = 0): VariantRow[] {
  const valid = groups.filter(g =>
    g.name.trim() && g.values.some(v => v.trim()) && g.enabled !== false,
  );
  if (valid.length === 0) return [];
  let result: { groupName: string; value: string }[][] = [[]];
  for (const group of valid) {
    const next: { groupName: string; value: string }[][] = [];
    for (const existing of result) {
      for (const value of group.values.filter(v => v.trim())) {
        next.push([...existing, { groupName: group.name.trim(), value: value.trim() }]);
      }
    }
    result = next;
  }
  return result.map((combo, i) => ({
    id: `gen-${Date.now()}-${i}`,
    combination: combo,
    label: combo.map(c => c.value).join(" / "),
    sku: "", price: null, compareAtPrice: null, barcode: "",
    weightGrams: null, stock: defaultStock, images: [], active: true,
  }));
}

export function buildVariantPayload(groups: AttributeGroup[], variants: VariantRow[]) {
  const validGroups = groups.filter(g =>
    g.name.trim() && g.values.some(v => v.trim()) && g.enabled !== false,
  );
  return {
    groups: validGroups.map(g => ({
      name: g.name.trim(),
      options: g.values.filter(v => v.trim()).map(v => v.trim()),
    })),
    variants: variants.map(v => ({
      options: v.combination
        .map(c => {
          const gi = validGroups.findIndex(g => g.name.trim() === c.groupName);
          const g = validGroups[gi];
          const oi = g ? g.values.filter(x => x.trim()).findIndex(x => x.trim() === c.value) : -1;
          return { groupIndex: gi, optionIndex: oi };
        })
        .filter(o => o.groupIndex >= 0 && o.optionIndex >= 0),
      sku:            v.sku.trim() || undefined,
      price:          v.price != null && v.price > 0 ? v.price : undefined,
      compareAtPrice: v.compareAtPrice != null && v.compareAtPrice > 0 ? v.compareAtPrice : undefined,
      barcode:        v.barcode.trim() || undefined,
      weightGrams:    v.weightGrams != null && v.weightGrams > 0 ? v.weightGrams : undefined,
      stock:          Math.max(0, Math.round(v.stock)),
      images:         v.images.filter(u => u.trim()),
      active:         v.active,
    })),
  };
}

// ─── Toggle ────────────────────────────────────────────────────────────────────
// BULLETPROOF: position:absolute thumb with physical pixel left — direction-agnostic.
// track=44px, thumb=16px. OFF: left=2px. ON: left=26px. Both inside track always.
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 touch-manipulation",
        on ? "bg-primary shadow-sm" : "bg-muted-foreground/30",
      )}
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200"
        style={{ left: on ? 26 : 2 }}
      />
    </button>
  );
}

// ─── InlineTagInput ────────────────────────────────────────────────────────────
function InlineTagInput({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder?: string }) {
  const [val, setVal] = useState("");
  const submit = useCallback((raw: string) => {
    raw.split(/[,\n]+/).map(v => v.trim()).filter(Boolean).forEach(v => onAdd(v));
    setVal("");
  }, [onAdd]);
  return (
    <div className="relative">
      <Plus className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60 pointer-events-none" />
      <Input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); submit(val); } }}
        onPaste={e => { e.preventDefault(); submit(e.clipboardData.getData("text")); }}
        placeholder={placeholder}
        className="ps-9 h-11 text-sm border-dashed border-primary/30 placeholder:text-muted-foreground/50 rounded-xl focus-visible:border-primary/60 transition-colors"
      />
    </div>
  );
}

// ─── CombinationCard ───────────────────────────────────────────────────────────
function CombinationCard({
  variant,
  onUpdate,
  showImages,
  onToggleImages,
}: {
  variant: VariantRow;
  onUpdate: (field: keyof VariantRow, value: unknown) => void;
  showImages: boolean;
  onToggleImages: () => void;
}) {
  const { t } = useTranslation();
  const firstGroup = variant.combination[0];
  const colorHex   = firstGroup && isColorGroup(firstGroup.groupName) ? getColorHex(firstGroup.value) : null;
  const imageCount = variant.images.filter(u => u.trim()).length;
  const firstImg   = imageCount > 0 ? variant.images.find(u => u.trim()) : null;

  const addImage  = () => { if (variant.images.length < 8) onUpdate("images", [...variant.images, ""]); };
  const removeImg = (i: number) => onUpdate("images", variant.images.filter((_, idx) => idx !== i));
  const updateImg = (i: number, v: string) => {
    const next = [...variant.images]; next[i] = v; onUpdate("images", next);
  };

  return (
    <div className={cn(
      "rounded-2xl border bg-card shadow-sm overflow-hidden transition-opacity duration-150",
      !variant.active && "opacity-60",
    )}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/20">
        {/* Swatch / thumbnail */}
        <div className="h-10 w-10 rounded-xl border overflow-hidden shrink-0 flex items-center justify-center bg-muted">
          {colorHex ? (
            <span className="block h-full w-full" style={{ backgroundColor: colorHex }} />
          ) : firstImg ? (
            <img src={firstImg} alt="" className="h-full w-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
          )}
        </div>

        {/* Label */}
        <p className="text-sm font-semibold flex-1 min-w-0 truncate">{variant.label}</p>

        {/* Active toggle */}
        <Toggle on={variant.active} onToggle={() => onUpdate("active", !variant.active)} />
      </div>

      {/* ── Body ── */}
      <div className="p-3.5 space-y-3">
        {/* Fields 2×2 */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {t("variants.price_col", "Price")}
            </p>
            <Input
              type="number" step="0.01" min="0"
              value={variant.price ?? ""}
              onChange={e => onUpdate("price", e.target.value === "" ? null : parseFloat(e.target.value) || null)}
              placeholder={t("variants.price_inherit", "Inherit")}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {t("variants.compare_col", "Compare At")}
            </p>
            <Input
              type="number" step="0.01" min="0"
              value={variant.compareAtPrice ?? ""}
              onChange={e => onUpdate("compareAtPrice", e.target.value === "" ? null : parseFloat(e.target.value) || null)}
              placeholder="—"
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {t("variants.stock_col", "Stock")}
            </p>
            <Input
              type="number" min="0" step="1"
              value={variant.stock}
              onChange={e => onUpdate("stock", parseInt(e.target.value) || 0)}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {t("variants.sku_col", "SKU")}
            </p>
            <Input
              value={variant.sku}
              onChange={e => onUpdate("sku", e.target.value)}
              placeholder={t("variants.sku_optional", "Optional")}
              className="h-10 text-sm"
            />
          </div>
        </div>

        {/* Images toggle */}
        <button
          type="button"
          onClick={onToggleImages}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[36px] touch-manipulation w-full"
        >
          <div className="h-7 w-7 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {firstImg ? (
              <img src={firstImg} alt="" className="h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </div>
          <span className="flex-1 text-start">
            {imageCount > 0
              ? t("variants.images_count", "{{count}} image(s)", { count: imageCount })
              : t("variants.add_images", "Add images")}
          </span>
          {showImages ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
        </button>

        {/* Expanded images */}
        {showImages && (
          <div className="rounded-xl border border-dashed bg-muted/20 p-3 space-y-2">
            {variant.images.map((url, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="h-8 w-8 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {url ? (
                    <img src={url} alt="" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <ImageIcon className="h-3 w-3 text-muted-foreground/40" />
                  )}
                </div>
                <Input
                  value={url}
                  onChange={e => updateImg(i, e.target.value)}
                  placeholder={t("variants.image_url_placeholder", "Image URL")}
                  className="h-8 text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeImg(i)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors shrink-0 touch-manipulation"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {variant.images.length < 8 && (
              <button
                type="button"
                onClick={addImage}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors min-h-[36px] touch-manipulation"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("variants.add_image", "Add image URL")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SectionCard ───────────────────────────────────────────────────────────────
function SectionCard({
  step, title, subtitle, children, action,
}: {
  step: number | string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 border-b bg-muted/20">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold shrink-0">
          {step}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="ms-auto shrink-0">{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Main VariantBuilder ───────────────────────────────────────────────────────
export function VariantBuilder({
  groups, onGroupsChange, variants, onVariantsChange, defaultStock = 0,
  hasVariants, onHasVariantsChange,
}: VariantBuilderProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [dragOverIdx, setDragOverIdx]         = useState<number | null>(null);
  const dragSrcIdx                            = useRef<number | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName]           = useState("");
  const customInputRef                        = useRef<HTMLInputElement>(null);
  const [expandedImgs, setExpandedImgs]       = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ── Bulk state ────────────────────────────────────────────────────────────────
  const [bulkPrice, setBulkPrice]       = useState("");
  const [bulkCompare, setBulkCompare]   = useState("");
  const [bulkStock, setBulkStock]       = useState("");
  const [bulkSkuPrefix, setBulkSkuPrefix] = useState("");

  // ── Computed ──────────────────────────────────────────────────────────────────
  const enabledGroups = useMemo(
    () => groups.filter(g => g.enabled !== false && g.name.trim() && g.values.some(v => v.trim())),
    [groups],
  );
  const combinationCount = useMemo(
    () => enabledGroups.length === 0
      ? 0
      : enabledGroups.reduce((acc, g) => acc * g.values.filter(v => v.trim()).length, 1),
    [enabledGroups],
  );

  // ── Group mutations ───────────────────────────────────────────────────────────
  const addPreset = useCallback((preset: Preset) => {
    if (groups.some(g => g.name.toLowerCase() === preset.name.toLowerCase() || g.name === preset.nameAr)) return;
    onGroupsChange([...groups, { id: `grp-${Date.now()}`, name: preset.name, values: [], enabled: true }]);
  }, [groups, onGroupsChange]);

  const addCustomGroup = useCallback(() => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (groups.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) { setCustomName(""); setShowCustomInput(false); return; }
    onGroupsChange([...groups, { id: `grp-${Date.now()}`, name: trimmed, values: [], enabled: true }]);
    setCustomName("");
    setShowCustomInput(false);
  }, [customName, groups, onGroupsChange]);

  const removeGroup        = useCallback((id: string) => onGroupsChange(groups.filter(g => g.id !== id)), [groups, onGroupsChange]);
  const toggleGroupEnabled = useCallback((id: string) => onGroupsChange(groups.map(g => g.id === id ? { ...g, enabled: g.enabled === false ? true : false } : g)), [groups, onGroupsChange]);
  const toggleGroupCollapsed = useCallback((id: string) => setCollapsedGroups(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }), []);

  const addValue    = useCallback((id: string, value: string) =>
    onGroupsChange(groups.map(g =>
      g.id === id && !g.values.map(v => v.toLowerCase()).includes(value.toLowerCase())
        ? { ...g, values: [...g.values, value] }
        : g,
    )), [groups, onGroupsChange]);

  const removeValue = useCallback((id: string, value: string) =>
    onGroupsChange(groups.map(g => g.id === id ? { ...g, values: g.values.filter(v => v !== value) } : g)),
  [groups, onGroupsChange]);

  // ── Drag & drop ───────────────────────────────────────────────────────────────
  const onDragStart = useCallback((idx: number) => { dragSrcIdx.current = idx; }, []);
  const onDragOver  = useCallback((e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); }, []);
  const onDrop      = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const srcIdx = dragSrcIdx.current;
    if (srcIdx !== null && srcIdx !== targetIdx) {
      const next = [...groups];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(targetIdx, 0, moved);
      onGroupsChange(next);
    }
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  }, [groups, onGroupsChange]);
  const onDragEnd = useCallback(() => { dragSrcIdx.current = null; setDragOverIdx(null); }, []);

  // ── Generate ──────────────────────────────────────────────────────────────────
  const generate = useCallback(() => {
    onVariantsChange(cartesianVariants(groups, defaultStock));
    setExpandedImgs(new Set());
  }, [groups, defaultStock, onVariantsChange]);

  // ── Variant mutations ─────────────────────────────────────────────────────────
  const updateVariant = useCallback((id: string, field: keyof VariantRow, value: unknown) =>
    onVariantsChange(variants.map(v => v.id === id ? { ...v, [field]: value } : v)),
  [variants, onVariantsChange]);

  const toggleImgExpand = useCallback((id: string) => setExpandedImgs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }), []);

  // ── Bulk actions ──────────────────────────────────────────────────────────────
  const applyBulkAll = useCallback(() => {
    let skuIdx = 0;
    onVariantsChange(variants.map(v => {
      const upd: Partial<VariantRow> = {};
      if (bulkPrice    !== "") upd.price         = parseFloat(bulkPrice)   || null;
      if (bulkCompare  !== "") upd.compareAtPrice = parseFloat(bulkCompare) || null;
      if (bulkStock    !== "") upd.stock          = parseInt(bulkStock)    || 0;
      if (bulkSkuPrefix !== "") upd.sku = `${bulkSkuPrefix}-${String(++skuIdx).padStart(3, "0")}`;
      return { ...v, ...upd };
    }));
  }, [variants, bulkPrice, bulkCompare, bulkStock, bulkSkuPrefix, onVariantsChange]);

  const enableAll  = useCallback(() => onVariantsChange(variants.map(v => ({ ...v, active: true }))),  [variants, onVariantsChange]);
  const disableAll = useCallback(() => onVariantsChange(variants.map(v => ({ ...v, active: false }))), [variants, onVariantsChange]);

  // ── Render ────────────────────────────────────────────────────────────────────
  const activeCount   = variants.filter(v => v.active).length;
  const inactiveCount = variants.length - activeCount;

  return (
    <div className="space-y-4">

      {/* ── has-variants toggle (when controlled externally) ────────────────── */}
      {onHasVariantsChange && (
        <div className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-muted/50 border">
          <Toggle on={hasVariants ?? true} onToggle={() => onHasVariantsChange(!(hasVariants ?? true))} />
          <span className="text-sm font-medium">{t("variants.has_variants_label")}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — OPTION GROUPS
          Add preset attribute groups or create a custom one.
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        step={1}
        title={t("variants.add_group_section", "Option Groups")}
        subtitle={t("variants.add_group_subtitle", "Choose the attributes that describe your product variants")}
      >
        <div className="space-y-4">

          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {(PRESETS as readonly Preset[]).map(preset => {
              const exists = groups.some(
                g => g.name.toLowerCase() === preset.name.toLowerCase() || g.name === preset.nameAr,
              );
              const label = isRtl ? preset.nameAr : preset.name;
              return (
                <button
                  key={preset.key}
                  type="button"
                  disabled={exists}
                  onClick={() => addPreset(preset)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 select-none min-h-[44px] touch-manipulation",
                    exists
                      ? "bg-primary/8 border-primary/20 text-primary/60 cursor-default"
                      : "bg-background hover:bg-primary/5 border-border hover:border-primary/40 text-foreground cursor-pointer hover:shadow-sm active:scale-[0.97]",
                  )}
                >
                  <span className="text-base leading-none">{preset.icon}</span>
                  {label}
                  {exists && <Check className="h-3.5 w-3.5 text-primary/60 shrink-0" />}
                </button>
              );
            })}

            {/* Custom chip / inline input */}
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => { setShowCustomInput(true); setTimeout(() => customInputRef.current?.focus(), 50); }}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-muted-foreground/30 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-150 cursor-pointer active:scale-[0.97] min-h-[44px] touch-manipulation"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("variants.custom", "Custom")}
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full mt-1">
                <Input
                  ref={customInputRef}
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); addCustomGroup(); }
                    if (e.key === "Escape") { setShowCustomInput(false); setCustomName(""); }
                  }}
                  placeholder={t("variants.custom_placeholder", "e.g. Language, Length, Warranty")}
                  className="h-11 text-sm flex-1"
                />
                <Button type="button" size="sm" className="h-11 px-5 shrink-0" onClick={addCustomGroup}>
                  {t("common.add", "Add")}
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowCustomInput(false); setCustomName(""); }}
                  className="h-11 w-11 flex items-center justify-center rounded-xl border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 touch-manipulation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {groups.length === 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-dashed">
              <Info className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                {t("variants.preset_hint", "Select an attribute type above, or create a custom group for your product.")}
              </p>
            </div>
          )}

          {/* ── Added group cards ── */}
          {groups.length > 0 && (
            <div className="space-y-3">
              {groups.map((group, gIdx) => {
                const isEnabled   = group.enabled !== false;
                const isCollapsed = collapsedGroups.has(group.id);
                const preset      = findPreset(group.name);
                const isColor     = isColorGroup(group.name);
                const isDragOver  = dragOverIdx === gIdx;

                const suggestions = (() => {
                  if (!preset) return [] as string[];
                  const list = i18n.language === "ar" ? preset.suggestionsAr : preset.suggestions;
                  return (list as readonly string[]).filter(
                    s => !group.values.map(v => v.toLowerCase()).includes(s.toLowerCase()),
                  );
                })();

                return (
                  <div
                    key={group.id}
                    draggable
                    onDragStart={() => onDragStart(gIdx)}
                    onDragOver={e => onDragOver(e, gIdx)}
                    onDrop={e => onDrop(e, gIdx)}
                    onDragEnd={onDragEnd}
                    className={cn(
                      "rounded-2xl border bg-background transition-all duration-150 shadow-sm",
                      isDragOver && "ring-2 ring-primary border-primary shadow-md scale-[1.01]",
                      !isEnabled && "opacity-60",
                    )}
                  >
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/10 rounded-t-2xl">
                      {/* Drag handle (desktop only) */}
                      <div className="hidden sm:flex text-muted-foreground/25 hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0 touch-none transition-colors">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Number bubble */}
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold shrink-0">
                        {gIdx + 1}
                      </span>

                      {/* Emoji */}
                      {preset && <span className="text-base leading-none shrink-0">{preset.icon}</span>}

                      {/* Group name */}
                      <span className="text-sm font-semibold flex-1 min-w-0 truncate">{group.name}</span>

                      {/* Value count badge */}
                      {group.values.filter(v => v.trim()).length > 0 && (
                        <Badge variant="secondary" className="text-xs font-bold tabular-nums shrink-0">
                          {group.values.filter(v => v.trim()).length}
                        </Badge>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Enable/disable toggle */}
                        <Toggle on={isEnabled} onToggle={() => toggleGroupEnabled(group.id)} />

                        {/* Collapse/expand */}
                        <button
                          type="button"
                          onClick={() => toggleGroupCollapsed(group.id)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors touch-manipulation"
                        >
                          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeGroup(group.id)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors touch-manipulation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Group body */}
                    {!isCollapsed && (
                      <div className="p-4 space-y-3">
                        {/* Existing value chips */}
                        {group.values.filter(v => v.trim()).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {group.values.filter(v => v.trim()).map(value => {
                              const hex = isColor ? getColorHex(value) : null;
                              return (
                                <span
                                  key={value}
                                  className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl border bg-muted/40 text-sm font-medium min-h-[36px] group/chip"
                                >
                                  {hex && (
                                    <span className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: hex }} />
                                  )}
                                  {value}
                                  <button
                                    type="button"
                                    onClick={() => removeValue(group.id, value)}
                                    className="h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Quick-add suggestions */}
                        {suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-xs font-medium text-muted-foreground/60 shrink-0 me-0.5">
                              {t("variants.quick_add", "Quick add:")}
                            </span>
                            {suggestions.slice(0, 8).map(s => {
                              const hex = isColor ? getColorHex(s) : null;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => addValue(group.id, s)}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-2 rounded-full border border-primary/20 text-primary/70 hover:bg-primary/8 hover:border-primary/50 hover:text-primary transition-all duration-150 min-h-[36px] touch-manipulation"
                                >
                                  {hex ? (
                                    <span className="h-3 w-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: hex }} />
                                  ) : (
                                    <Plus className="h-2.5 w-2.5 shrink-0" />
                                  )}
                                  {s}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Tag input */}
                        <InlineTagInput
                          onAdd={v => addValue(group.id, v)}
                          placeholder={
                            isColor
                              ? t("variants.add_color_placeholder", "Add color")
                              : `${t("variants.add_value_prefix", "Add")} ${group.name}`
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add another group */}
              <button
                type="button"
                onClick={() => { setShowCustomInput(true); setTimeout(() => customInputRef.current?.focus(), 50); }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 text-sm text-muted-foreground hover:text-primary transition-all duration-150 min-h-[52px] touch-manipulation"
              >
                <Plus className="h-4 w-4" />
                {t("variants.add_new_group", "Add Another Option Group")}
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          GENERATE BANNER — shows when groups have values but no variants yet,
          or when groups changed after last generate.
      ══════════════════════════════════════════════════════════════════════ */}
      {enabledGroups.length > 0 && (
        <div className={cn(
          "rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3",
          combinationCount > 0
            ? "bg-primary/5 border-primary/20"
            : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/30",
        )}>
          {/* Formula */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            {enabledGroups.map((g, i) => (
              <span key={g.id} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 bg-background border rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm">
                  <span className="text-primary font-bold tabular-nums">{g.values.filter(v => v.trim()).length}</span>
                  <span className="text-muted-foreground text-xs">{g.name}</span>
                </span>
                {i < enabledGroups.length - 1 && (
                  <span className="text-muted-foreground/60 font-bold text-sm">×</span>
                )}
              </span>
            ))}
            <span className="text-muted-foreground/60 font-bold text-sm">=</span>
            <span className="text-2xl font-extrabold text-primary tabular-nums">{combinationCount}</span>
            <span className="text-sm text-muted-foreground">{t("variants.combinations_label", "combinations")}</span>
          </div>

          {/* Generate button */}
          <Button
            type="button"
            onClick={generate}
            disabled={combinationCount === 0}
            className="gap-2 h-12 px-6 shrink-0 w-full sm:w-auto text-base font-semibold shadow-sm"
          >
            <Zap className="h-4 w-4" />
            {variants.length > 0
              ? t("variants.regenerate", "Regenerate")
              : combinationCount > 0
                ? t("variants.generate_n", "Generate {{count}}", { count: combinationCount })
                : t("variants.generate", "Generate")}
          </Button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — COMBINATIONS
          Card grid + bulk actions.
      ══════════════════════════════════════════════════════════════════════ */}
      {variants.length > 0 && (
        <SectionCard
          step={2}
          title={t("variants.manage_section", "Combinations")}
          subtitle={t("variants.manage_subtitle", "Set price, stock, and images for each combination")}
        >
          <div className="space-y-4">

            {/* ── Stats row ── */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t("variants.stat_total", "Total"),    value: variants.length, cls: "text-foreground" },
                { label: t("variants.stat_active", "Active"),  value: activeCount,     cls: "text-emerald-600 dark:text-emerald-400" },
                { label: t("variants.stat_inactive", "Off"),   value: inactiveCount,   cls: "text-muted-foreground" },
              ].map(s => (
                <div key={s.label} className="text-center rounded-xl bg-muted/40 py-2.5">
                  <p className={cn("text-xl font-bold leading-tight tabular-nums", s.cls)}>{s.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* ── Bulk actions ── */}
            <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("variants.bulk_title", "Apply to All")}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={enableAll}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors touch-manipulation min-h-[36px]"
                  >
                    {t("variants.enable_all", "Enable All")}
                  </button>
                  <button
                    type="button"
                    onClick={disableAll}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors touch-manipulation min-h-[36px]"
                  >
                    {t("variants.disable_all", "Disable All")}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("variants.price_col", "Price")}
                  </label>
                  <Input type="number" step="0.01" min="0" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} placeholder="—" className="h-10 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("variants.compare_col", "Compare At")}
                  </label>
                  <Input type="number" step="0.01" min="0" value={bulkCompare} onChange={e => setBulkCompare(e.target.value)} placeholder="—" className="h-10 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("variants.stock_col", "Stock")}
                  </label>
                  <Input type="number" min="0" step="1" value={bulkStock} onChange={e => setBulkStock(e.target.value)} placeholder="—" className="h-10 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("variants.bulk_sku_prefix", "SKU Prefix")}
                  </label>
                  <Input value={bulkSkuPrefix} onChange={e => setBulkSkuPrefix(e.target.value)} placeholder="SKU-" className="h-10 text-sm" />
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                className="h-10 px-5 w-full sm:w-auto gap-2"
                onClick={applyBulkAll}
                disabled={!bulkPrice && !bulkCompare && !bulkStock && !bulkSkuPrefix}
              >
                <Check className="h-3.5 w-3.5" />
                {t("variants.apply_to_all", "Apply to All {{count}}", { count: variants.length })}
              </Button>
            </div>

            {/* ── Combination cards grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {variants.map(variant => (
                <CombinationCard
                  key={variant.id}
                  variant={variant}
                  onUpdate={(field, value) => updateVariant(variant.id, field, value)}
                  showImages={expandedImgs.has(variant.id)}
                  onToggleImages={() => toggleImgExpand(variant.id)}
                />
              ))}
            </div>

          </div>
        </SectionCard>
      )}

    </div>
  );
}
