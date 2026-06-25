// @refresh reset
import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CATEGORIES } from "@/lib/categories";
import {
  VariantBuilder,
  buildVariantPayload,
  type AttributeGroup,
  type VariantRow,
} from "@/components/VariantBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel,
  FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, ChevronRight, Check, Camera, X, ImageIcon,
  Package, Tag, Layers, FileText, Plus, Trash2,
  Bold, Italic, List, Link2, Info, CheckCircle2,
  Eye, Pencil,
} from "lucide-react";
import { parseSpecsFromDescription } from "@/lib/productUtils";

// ─── Schemas ──────────────────────────────────────────────────────────────────
const wizardSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().min(0.01, "Price must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  stock: z.coerce.number().int().min(0).optional().default(0),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});
type WizardFormValues = z.infer<typeof wizardSchema>;

// ─── Public types ──────────────────────────────────────────────────────────────
export interface WizardPayload {
  formData: WizardFormValues;
  galleryUrls: string[];
  discountPct: number;
  salePrice: number;
  variantsEnabled: boolean;
  variantGroups: AttributeGroup[];
  variantRows: VariantRow[];
  specs: { id: string; key: string; value: string }[];
}

export interface WizardInitialData {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  subcategory?: string;
  stock?: number;
  imageUrl?: string;
  imageUrls?: string[];
  discountPercent?: number;
  variantGroups?: any[];
  variants?: any[];
}

export interface ProductWizardProps {
  mode: "new" | "edit";
  isPending: boolean;
  onSubmit: (payload: WizardPayload) => void;
  initialData?: WizardInitialData;
  existingStock?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Sec({
  icon: Icon, title, subtitle, children,
  iconBg = "bg-primary/10", iconColor = "text-primary",
}: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode;
  iconBg?: string; iconColor?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3.5 border-b flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold leading-snug">{title}</p>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function DescToolbar({ onFormat }: { onFormat: (b: string, a?: string, block?: boolean) => void }) {
  const actions = [
    { icon: Bold,   label: "Bold",   b: "**", a: "**",      block: false },
    { icon: Italic, label: "Italic", b: "_",  a: "_",       block: false },
    { icon: List,   label: "List",   b: "• ", a: "",        block: true  },
    { icon: Link2,  label: "Link",   b: "[",  a: "](url)",  block: false },
  ] as const;
  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b flex-wrap bg-muted/20">
      {actions.map(({ icon: Icon, label, b, a, block }) => (
        <button
          key={label} type="button" title={label}
          onClick={() => onFormat(b, a as string, block as boolean)}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-manipulation"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function WizardProgressBar({
  currentStep,
  stepLabels,
  completedSteps,
  onStepClick,
  mode,
}: {
  currentStep: number;
  stepLabels: string[];
  completedSteps: Set<number>;
  onStepClick: (idx: number) => void;
  mode: "new" | "edit";
}) {
  return (
    <div className="sticky top-0 z-30 bg-background border-b shadow-sm">
      {/* thin progress line */}
      <div className="h-0.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentStep + 1) / stepLabels.length) * 100}%` }}
        />
      </div>
      <div className="flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {stepLabels.map((label, i) => {
          const isDone = completedSteps.has(i);
          const isCurrent = i === currentStep;
          const isClickable = mode === "edit" ? true : (isDone || isCurrent);
          return (
            <button
              key={i}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(i)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2.5 shrink-0 min-w-[64px] transition-colors touch-manipulation",
                isCurrent
                  ? "text-primary border-b-2 border-primary"
                  : isClickable
                    ? "text-primary/70 hover:bg-muted/40"
                    : "text-muted-foreground/40 cursor-default",
              )}
            >
              <span className={cn(
                "h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground/50",
              )}>
                {isDone && !isCurrent ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="text-[10px] font-medium whitespace-nowrap leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Image section (shared across steps 1 and review) ─────────────────────────
function ImageSection({
  coverUrl,
  galleryUrls,
  pendingImg,
  setPendingImg,
  showImgInput,
  setShowImgInput,
  addImage,
  removeImage,
}: {
  coverUrl: string;
  galleryUrls: string[];
  pendingImg: string;
  setPendingImg: (v: string) => void;
  showImgInput: boolean;
  setShowImgInput: (v: boolean) => void;
  addImage: () => void;
  removeImage: (isCover: boolean, idx: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const allImages = [
    ...(coverUrl && isValidUrl(coverUrl) ? [{ url: coverUrl, isCover: true, idx: -1 }] : []),
    ...galleryUrls.map((url, idx) => ({ url, isCover: false, idx })).filter(img => img.url && isValidUrl(img.url)),
  ];

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <button
          type="button"
          onClick={() => setShowImgInput(!showImgInput)}
          className={cn(
            "h-28 w-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center shrink-0 gap-1.5 touch-manipulation transition-colors",
            showImgInput
              ? "border-primary/60 bg-primary/8"
              : "border-primary/30 bg-primary/5 hover:border-primary/60 hover:bg-primary/8",
          )}
        >
          <Camera className="h-8 w-8 text-primary/60" />
          <span className="text-[10px] font-semibold text-primary/70 text-center leading-tight px-1">
            {t("seller_products.upload_area_label")}
          </span>
          <span className="text-[9px] text-muted-foreground/60 text-center">
            {t("seller_products.upload_area_hint")}
          </span>
        </button>

        {allImages.map(({ url, isCover, idx }) => (
          <div key={isCover ? "cover" : idx} className="h-28 w-28 rounded-2xl border bg-muted overflow-hidden relative shrink-0">
            <img src={url} alt="" className="w-full h-full object-cover" />
            {isCover && (
              <span className="absolute bottom-1 start-1 text-[8px] font-bold bg-primary text-primary-foreground rounded px-1 py-0.5">
                {lang === "ar" ? "غلاف" : "Cover"}
              </span>
            )}
            <button
              type="button"
              onClick={() => removeImage(isCover, idx)}
              className="absolute top-1.5 end-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center touch-manipulation"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {allImages.length === 0 && (
          <div className="h-28 w-28 rounded-2xl border-2 border-dashed border-muted-foreground/15 bg-muted/30 flex flex-col items-center justify-center shrink-0 gap-1.5">
            <ImageIcon className="h-7 w-7 text-muted-foreground/30" />
            <span className="text-[9px] text-muted-foreground/50 text-center">{t("seller_products.no_images_yet")}</span>
          </div>
        )}
      </div>

      {showImgInput && (
        <div className="flex gap-2 items-center pt-1">
          <Input
            value={pendingImg}
            onChange={e => setPendingImg(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
            placeholder={t("seller_products.image_url_placeholder")}
            className="h-12 flex-1 text-base"
            autoFocus
          />
          <Button type="button" onClick={addImage} className="h-12 px-5 shrink-0">
            {t("common.add")}
          </Button>
          <button
            type="button"
            onClick={() => { setShowImgInput(false); setPendingImg(""); }}
            className="h-12 w-12 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-xl border hover:bg-muted/60 transition-colors touch-manipulation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function ProductWizard({
  mode,
  isPending,
  onSubmit,
  initialData,
  existingStock,
}: ProductWizardProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { format } = useCurrency();
  const isRtl = i18n.language === "ar";
  const lang = i18n.language;
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  // ── Step state ───────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    mode === "edit" ? new Set([0, 1, 2, 3, 4]) : new Set()
  );

  const stepLabels = [
    t("seller_products.step_basic"),
    t("seller_products.step_pricing"),
    t("seller_products.step_variants"),
    t("seller_products.step_specs"),
    t("seller_products.step_publish"),
  ];

  // ── Form ─────────────────────────────────────────────────────────────────────
  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      name: "", description: "", price: 0,
      category: initialData?.category ?? "",
      subcategory: initialData?.subcategory ?? "",
      stock: 0, imageUrl: "",
    },
  });

  // ── Derived form state ────────────────────────────────────────────────────────
  const coverUrl = form.watch("imageUrl") || "";
  const watchedCategory = form.watch("category");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(initialData?.category ?? "");
  const selectedCategory = CATEGORIES.find(c => c.slug === selectedCategorySlug);

  // ── Images ───────────────────────────────────────────────────────────────────
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [pendingImg, setPendingImg] = useState("");
  const [showImgInput, setShowImgInput] = useState(false);

  // ── Pricing ──────────────────────────────────────────────────────────────────
  const [discountPct, setDiscountPct] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // ── Variants ─────────────────────────────────────────────────────────────────
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [variantGroups, setVariantGroups] = useState<AttributeGroup[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  // ── Specs ────────────────────────────────────────────────────────────────────
  const [specs, setSpecs] = useState<{ id: string; key: string; value: string }[]>([]);
  const addSpec = () => setSpecs(p => [...p, { id: `sp-${Date.now()}`, key: "", value: "" }]);
  const removeSpec = (id: string) => setSpecs(p => p.filter(s => s.id !== id));
  const updateSpec = (id: string, f: "key" | "value", v: string) =>
    setSpecs(p => p.map(s => s.id === id ? { ...s, [f]: v } : s));

  const descRef = useRef<HTMLTextAreaElement>(null);

  // ── Populate from initialData (edit mode) ─────────────────────────────────────
  useEffect(() => {
    if (!initialData) return;
    const catSlug = initialData.category || "";
    setSelectedCategorySlug(catSlug);

    const { specs: parsedSpecs, description: cleanDesc } =
      parseSpecsFromDescription(initialData.description || "");
    setSpecs(parsedSpecs);
    setGalleryUrls(initialData.imageUrls ?? []);

    const dp = initialData.discountPercent ?? 0;
    setDiscountPct(dp);
    const basePrice = initialData.price ?? 0;
    setSalePrice(parseFloat((basePrice * (1 - dp / 100)).toFixed(2)));

    form.reset({
      name: initialData.name ?? "",
      description: cleanDesc,
      price: initialData.price ?? 0,
      category: catSlug,
      subcategory: initialData.subcategory ?? "",
      stock: initialData.stock ?? 0,
      imageUrl: initialData.imageUrl ?? "",
    });

    const apiGroups = initialData.variantGroups ?? [];
    if (apiGroups.length > 0) {
      setVariantsEnabled(true);
      setVariantGroups(apiGroups.map((g: any) => ({
        id: `grp-${g.id}`, name: g.name,
        values: (g.options ?? []).map((o: any) => o.value),
      })));
      setVariantRows((initialData.variants ?? []).map((v: any) => ({
        id: `var-${v.id}`,
        combination: (v.options ?? []).map((o: any) => ({ groupName: o.groupName, value: o.value })),
        label: v.label, sku: v.sku ?? "", price: v.price ?? null,
        compareAtPrice: v.compareAtPrice ?? null, barcode: v.barcode ?? "",
        weightGrams: v.weightGrams ?? null, stock: v.stock,
        images: (v.images ?? []).map((i: any) => (typeof i === "string" ? i : i?.url)).filter(Boolean),
        active: v.active,
      })));
    }
  }, [initialData?.name]);

  // keep form sync when category changes externally
  useEffect(() => {
    if (watchedCategory && watchedCategory !== selectedCategorySlug) {
      setSelectedCategorySlug(watchedCategory);
    }
  }, [watchedCategory]);

  // ── Image helpers ─────────────────────────────────────────────────────────────
  const addImage = useCallback(() => {
    const url = pendingImg.trim();
    if (!url || !isValidUrl(url)) return;
    if (!coverUrl) { form.setValue("imageUrl", url); }
    else if (galleryUrls.length < 9) { setGalleryUrls(p => [...p, url]); }
    setPendingImg("");
    setShowImgInput(false);
  }, [pendingImg, coverUrl, galleryUrls, form]);

  const removeImage = useCallback((isCover: boolean, idx: number) => {
    if (isCover) {
      if (galleryUrls.length > 0) {
        form.setValue("imageUrl", galleryUrls[0]);
        setGalleryUrls(g => g.slice(1));
      } else {
        form.setValue("imageUrl", "");
      }
    } else {
      setGalleryUrls(g => g.filter((_, i) => i !== idx));
    }
  }, [galleryUrls, form]);

  // ── Description toolbar ───────────────────────────────────────────────────────
  const insertFormat = useCallback((before: string, after = before, blockMode = false) => {
    const el = descRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const cur = form.getValues("description") || "";
    const selected = cur.substring(s, e);
    let newVal: string;
    let newCursor: number;
    if (blockMode) {
      const lineStart = cur.lastIndexOf("\n", s - 1) + 1;
      newVal = cur.substring(0, lineStart) + before + cur.substring(lineStart);
      newCursor = s + before.length;
    } else {
      newVal = cur.substring(0, s) + before + selected + after + cur.substring(e);
      newCursor = s + before.length;
    }
    form.setValue("description", newVal, { shouldValidate: false });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCursor, e === s ? newCursor : e + before.length);
    });
  }, [form]);

  // ── Step validation & navigation ──────────────────────────────────────────────
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 0:
        return form.trigger(["name", "category"]);
      case 1:
        if (pricingError) {
          toast({ title: pricingError, variant: "destructive" });
          return false;
        }
        return form.trigger(["price"]);
      case 2:
        if (variantsEnabled && variantGroups.length > 0 && variantRows.length === 0) {
          toast({ title: t("variants.generate_warning", "Click Generate to create variant combinations, or disable variants."), variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        return form.trigger(["description"]);
      default:
        return true;
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (idx: number) => {
    setCurrentStep(idx);
    scrollToTop();
  };

  const handleNext = async () => {
    const valid = await validateStep(currentStep);
    if (!valid) {
      const el = document.querySelector<HTMLElement>("[aria-invalid='true']");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    setCurrentStep(s => Math.min(s + 1, stepLabels.length - 1));
    scrollToTop();
  };

  const handleBack = () => {
    setCurrentStep(s => Math.max(s - 1, 0));
    scrollToTop();
  };

  // ── Final submit ──────────────────────────────────────────────────────────────
  const handlePublish = () => {
    const data = form.getValues();
    onSubmit({
      formData: data,
      galleryUrls,
      discountPct,
      salePrice,
      variantsEnabled,
      variantGroups,
      variantRows,
      specs,
    });
  };

  // ── Render steps ───────────────────────────────────────────────────────────────
  const allImages = [
    ...(coverUrl && isValidUrl(coverUrl) ? [{ url: coverUrl, isCover: true, idx: -1 }] : []),
    ...galleryUrls.map((url, idx) => ({ url, isCover: false, idx })).filter(img => img.url && isValidUrl(img.url)),
  ];

  const renderStep1 = () => (
    <div className="space-y-3">
      {/* Images */}
      <Sec icon={Camera} title={t("seller_products.images_section")} iconBg="bg-emerald-500/10" iconColor="text-emerald-600">
        <ImageSection
          coverUrl={coverUrl}
          galleryUrls={galleryUrls}
          pendingImg={pendingImg}
          setPendingImg={setPendingImg}
          showImgInput={showImgInput}
          setShowImgInput={setShowImgInput}
          addImage={addImage}
          removeImage={removeImage}
        />
      </Sec>

      {/* Product Name */}
      <Sec icon={Package} title={t("seller_products.product_name")} iconBg="bg-blue-500/10" iconColor="text-blue-600">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller_products.product_name")} <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  placeholder={t("seller_products.product_name_placeholder")}
                  className="h-12 text-base"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Sec>

      {/* Category */}
      <Sec
        icon={CheckCircle2}
        title={t("seller_products.category_section_title")}
        subtitle={t("seller_products.category_section_desc")}
        iconBg="bg-violet-500/10"
        iconColor="text-violet-600"
      >
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("seller_products.main_category")} <span className="text-destructive">*</span></FormLabel>
              <Select
                value={field.value}
                onValueChange={val => {
                  field.onChange(val);
                  setSelectedCategorySlug(val);
                  form.setValue("subcategory", "");
                }}
              >
                <FormControl>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder={t("seller_products.select_category")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent
                  position="popper"
                  side="bottom"
                  sideOffset={4}
                  avoidCollisions={false}
                  className="max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain"
                >
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.slug} value={cat.slug} className="min-h-[44px] cursor-pointer">
                      {lang === "ar" ? cat.ar : cat.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedCategory && (
          <FormField
            control={form.control}
            name="subcategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("seller_products.subcategory")}</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder={t("seller_products.select_subcategory")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain"
                  >
                    {selectedCategory.subcategories.map(sub => (
                      <SelectItem key={sub.slug} value={sub.slug} className="min-h-[44px] cursor-pointer">
                        {lang === "ar" ? sub.ar : sub.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs">{t("seller_products.subcategory_optional")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

      </Sec>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-3">
      {/* Pricing */}
      <Sec
        icon={Tag}
        title={t("seller_products.pricing_section_title")}
        subtitle={t("seller_products.pricing_section_desc")}
        iconBg="bg-amber-500/10"
        iconColor="text-amber-600"
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">
                  {t("seller_products.original_price_label")} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number" step="0.01" min="0" placeholder="10000"
                    className="h-12 text-base tabular-nums"
                    {...field}
                    value={field.value || ""}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      field.onChange(val);
                      setSalePrice(parseFloat((val * (1 - discountPct / 100)).toFixed(2)));
                      setPricingError(null);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none block">
              {t("seller_products.sale_price_label")}
            </label>
            <Input
              type="number" step="0.01" min="0" placeholder="8000"
              value={salePrice || ""}
              className={cn("h-12 text-base tabular-nums", pricingError ? "border-destructive" : "")}
              onChange={e => {
                const sp = parseFloat(e.target.value) || 0;
                setSalePrice(sp);
                const orig = form.getValues("price");
                if (orig > 0 && sp > orig) {
                  setPricingError(t("seller_products.sale_exceeds_original"));
                  setDiscountPct(0);
                } else {
                  setPricingError(null);
                  if (orig > 0) setDiscountPct(Math.min(90, Math.max(0, parseFloat(((1 - sp / orig) * 100).toFixed(1)))));
                }
              }}
            />
            {pricingError && <p className="text-xs text-destructive">{pricingError}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none block">
            {t("seller_products.discount_pct_label")}
          </label>
          <div className="relative">
            <Input
              type="number" step="0.1" min="0" max="90" placeholder="0"
              value={discountPct || ""}
              className="h-12 text-base pe-9 tabular-nums"
              onChange={e => {
                const dp = Math.min(90, Math.max(0, parseFloat(e.target.value) || 0));
                setDiscountPct(dp);
                setSalePrice(parseFloat((form.getValues("price") * (1 - dp / 100)).toFixed(2)));
                setPricingError(null);
              }}
            />
            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">%</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("seller_products.discount_pct_hint")}</p>
        </div>

        {discountPct > 0 && (
          <div className="flex items-center gap-2.5 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30 rounded-xl">
            <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {t("seller_products.price_preview_on_sale", {
                price: format(salePrice),
                percent: Number.isInteger(discountPct) ? discountPct : discountPct.toFixed(1),
              })}
            </span>
          </div>
        )}
      </Sec>

      {/* Stock */}
      <Sec icon={Package} title={t("seller_products.initial_stock")} iconBg="bg-orange-500/10" iconColor="text-orange-600">
        {mode === "new" ? (
          variantsEnabled ? (
            <div className="flex items-start gap-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 rounded-xl">
              <Package className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t("seller_products.stock_variant_managed")}
              </p>
            </div>
          ) : (
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("seller_products.initial_stock")} <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="1" min="0" placeholder="0"
                      className="h-12 text-base tabular-nums"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )
        ) : (
          <div className="h-12 px-4 border rounded-xl bg-muted/30 flex items-center gap-3">
            <span className="text-lg font-bold tabular-nums text-foreground">{existingStock ?? 0}</span>
            <span className="text-sm text-muted-foreground">{t("seller_products.stock_managed")}</span>
          </div>
        )}
      </Sec>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-3">
      {/* Toggle card — always visible */}
      <Sec
        icon={Layers}
        title={t("variants.section_title")}
        subtitle={t("variants.section_desc")}
        iconBg="bg-indigo-500/10"
        iconColor="text-indigo-600"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t("variants.has_variants_label", "This product has multiple options")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {variantsEnabled ? t("variants.toggle_on") : t("variants.toggle_off")}
            </p>
          </div>
          <button
            type="button"
            aria-pressed={variantsEnabled}
            onClick={() => setVariantsEnabled(p => !p)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 touch-manipulation",
              variantsEnabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200"
              style={{ left: variantsEnabled ? 26 : 2 }}
            />
          </button>
        </div>

        {!variantsEnabled && (
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/15 bg-muted/20 p-6 flex flex-col items-center gap-2 text-center mt-1">
            <Layers className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              {t("seller_products.wizard_no_variants_hint", "Enable variants to offer sizes, colors, or other options")}
            </p>
          </div>
        )}
      </Sec>

      {/* VariantBuilder renders full-width outside the Sec card to avoid double-boxing */}
      {variantsEnabled && (
        <>
          <VariantBuilder
            groups={variantGroups}
            onGroupsChange={setVariantGroups}
            variants={variantRows}
            onVariantsChange={setVariantRows}
          />
          {variantRows.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium px-1">
              {t("variants.stock_note")}
            </p>
          )}
        </>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-3">
      {/* Specifications */}
      <Sec
        icon={FileText}
        title={t("seller_products.specs_section")}
        subtitle={t("seller_products.specs_section_desc")}
        iconBg="bg-teal-500/10"
        iconColor="text-teal-600"
      >
        {selectedCategory && selectedCategory.attributes.length > 0 && (
          <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs font-semibold text-primary">{t("seller_products.suggested_attributes")}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{t("seller_products.suggested_attributes_desc")}</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedCategory.attributes.map(attr => {
                const label = lang === "ar" ? attr.ar : attr.en;
                const alreadyAdded = specs.some(
                  s => s.key.trim().toLowerCase() === label.trim().toLowerCase()
                );
                return (
                  <button
                    key={attr.key}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => {
                      if (!alreadyAdded) {
                        setSpecs(p => [...p, { id: `sp-${Date.now()}`, key: label, value: "" }]);
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors touch-manipulation",
                      alreadyAdded
                        ? "border-primary/15 bg-primary/5 text-primary/40 cursor-default"
                        : "border-primary/25 bg-background text-primary hover:bg-primary/10 hover:border-primary/40 cursor-pointer"
                    )}
                  >
                    {alreadyAdded && <Check className="h-3 w-3 shrink-0" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {specs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-teal-500/60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t("seller_products.specs_empty_title")}</p>
              <p className="text-xs text-muted-foreground max-w-[260px]">{t("seller_products.specs_empty_desc")}</p>
            </div>
            <button
              type="button"
              onClick={addSpec}
              className="mt-1 h-11 px-5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors touch-manipulation flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("seller_products.add_spec")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {specs.map((spec, si) => (
              <div
                key={spec.id}
                className="rounded-xl border bg-card shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("seller_products.spec_number", { num: si + 1 })}
                  </span>
                </div>
                {/* Card body */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground block">
                      {t("seller_products.spec_attr_label")}
                    </label>
                    <Input
                      value={spec.key}
                      onChange={e => updateSpec(spec.id, "key", e.target.value)}
                      placeholder={t("seller_products.spec_key_placeholder")}
                      className="h-11 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground block">
                      {t("seller_products.spec_value_label")}
                    </label>
                    <Input
                      value={spec.value}
                      onChange={e => updateSpec(spec.id, "value", e.target.value)}
                      placeholder={t("seller_products.spec_value_placeholder")}
                      className="h-11 text-sm"
                    />
                  </div>
                </div>
                {/* Card footer — remove action */}
                <div className="px-4 pb-3">
                  <button
                    type="button"
                    onClick={() => removeSpec(spec.id)}
                    className="w-full h-9 rounded-lg border border-destructive/20 text-destructive/70 text-xs font-medium hover:bg-destructive/5 hover:border-destructive/40 hover:text-destructive transition-colors touch-manipulation flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("seller_products.remove_spec")}
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addSpec}
              className="w-full h-12 border-2 border-dashed border-primary/25 rounded-xl text-sm font-semibold text-primary/70 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors touch-manipulation flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("seller_products.add_spec")}
            </button>
          </div>
        )}
      </Sec>

      {/* Description */}
      <Sec
        icon={FileText}
        title={t("seller_products.description")}
        subtitle={t("seller_products.description_section_desc")}
        iconBg="bg-rose-500/10"
        iconColor="text-rose-600"
      >
        <div className="rounded-xl border overflow-hidden">
          <DescToolbar onFormat={insertFormat} />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder={t("seller_products.description_placeholder")}
                    className="min-h-[200px] rounded-none border-0 text-base leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
                    {...field}
                    ref={el => {
                      field.ref(el);
                      (descRef as any).current = el;
                    }}
                  />
                </FormControl>
                <FormMessage className="px-3 pb-2" />
              </FormItem>
            )}
          />
        </div>
      </Sec>
    </div>
  );

  const renderStep5 = () => {
    const productName = form.getValues("name");
    const productPrice = form.getValues("price");
    const productCategorySlug = form.getValues("category");
    const productSubcat = form.getValues("subcategory");
    const productDesc = form.getValues("description");
    const cat = CATEGORIES.find(c => c.slug === productCategorySlug);
    const catName = cat ? (lang === "ar" ? cat.ar : cat.en) : productCategorySlug;
    const subcat = productSubcat && cat?.subcategories.find(s => s.slug === productSubcat);
    const subcatName = subcat ? (lang === "ar" ? subcat.ar : subcat.en) : "";
    const validSpecs = specs.filter(s => s.key.trim() && s.value.trim());

    const ReviewRow = ({ label, value }: { label: string; value: string }) => (
      <div className="flex justify-between items-start gap-3 py-2.5 border-b last:border-b-0">
        <span className="text-sm text-muted-foreground shrink-0">{label}</span>
        <span className="text-sm font-medium text-end">{value || "—"}</span>
      </div>
    );

    const SectionHeader = ({
      title, step, icon: Icon,
    }: { title: string; step: number; icon: React.ElementType }) => (
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-bold">{title}</p>
        </div>
        <button
          type="button"
          onClick={() => goToStep(step)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline touch-manipulation"
        >
          <Pencil className="h-3 w-3" />
          {t("seller_products.wizard_edit_step")}
        </button>
      </div>
    );

    return (
      <div className="space-y-3">
        {/* Review header */}
        <div className="rounded-2xl border bg-primary/5 border-primary/20 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-base">{t("seller_products.step_publish")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{t("seller_products.wizard_review_desc")}</p>
          </div>
        </div>

        {/* Images */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden p-4">
          <SectionHeader title={t("seller_products.images_section")} step={0} icon={Camera} />
          {allImages.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {allImages.map(({ url, isCover, idx }) => (
                <div key={isCover ? "cover" : idx} className="h-20 w-20 rounded-xl border bg-muted overflow-hidden relative shrink-0">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {isCover && (
                    <span className="absolute bottom-0.5 start-0.5 text-[7px] font-bold bg-primary text-primary-foreground rounded px-1">
                      {lang === "ar" ? "غلاف" : "Cover"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("seller_products.no_images_yet")}</p>
          )}
        </div>

        {/* Basic info */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden p-4">
          <SectionHeader title={t("seller_products.step_basic")} step={0} icon={Package} />
          <ReviewRow label={t("seller_products.product_name")} value={productName} />
          <ReviewRow label={t("seller_products.main_category")} value={catName} />
          {subcatName && <ReviewRow label={t("seller_products.subcategory")} value={subcatName} />}
        </div>

        {/* Pricing */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden p-4">
          <SectionHeader title={t("seller_products.step_pricing")} step={1} icon={Tag} />
          <ReviewRow label={t("seller_products.original_price_label")} value={format(productPrice)} />
          {discountPct > 0 && (
            <>
              <ReviewRow label={t("seller_products.sale_price_label")} value={format(salePrice)} />
              <ReviewRow
                label={t("seller_products.discount_pct_label")}
                value={`${Number.isInteger(discountPct) ? discountPct : discountPct.toFixed(1)}%`}
              />
            </>
          )}
          {mode === "new" && (
            <ReviewRow label={t("seller_products.initial_stock")} value={String(form.getValues("stock") ?? 0)} />
          )}
          {mode === "edit" && (
            <ReviewRow label={t("seller_products.stock_col")} value={String(existingStock ?? 0)} />
          )}
        </div>

        {/* Variants */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden p-4">
          <SectionHeader title={t("seller_products.step_variants")} step={2} icon={Layers} />
          {variantsEnabled && variantGroups.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {variantGroups.map(g => (
                  <span key={g.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                    {g.name}
                    {g.values.length > 0 && (
                      <span className="text-xs bg-primary text-primary-foreground rounded px-1.5">{g.values.length}</span>
                    )}
                  </span>
                ))}
              </div>
              {variantRows.length > 0 && (
                <p className="text-xs text-muted-foreground">{variantRows.length} {lang === "ar" ? "تركيبة" : "combinations"}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا يوجد خيارات" : "No variants"}</p>
          )}
        </div>

        {/* Specs & Description */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden p-4">
          <SectionHeader title={t("seller_products.step_specs")} step={3} icon={FileText} />
          {validSpecs.length > 0 && (
            <div className="space-y-1 mb-3">
              {validSpecs.map(s => (
                <div key={s.id} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0">{s.key}:</span>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          )}
          {productDesc ? (
            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{productDesc}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">{lang === "ar" ? "لا يوجد وصف" : "No description yet"}</p>
          )}
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────────
  const isLastStep = currentStep === stepLabels.length - 1;

  return (
    <Form {...form}>
      <form onSubmit={e => e.preventDefault()}>
        {/* Progress bar */}
        <WizardProgressBar
          currentStep={currentStep}
          stepLabels={stepLabels}
          completedSteps={completedSteps}
          onStepClick={goToStep}
          mode={mode}
        />

        {/* Step content */}
        <div className={cn(
          "px-3 pt-4 pb-36 mx-auto w-full",
          currentStep === 2 ? "max-w-5xl lg:max-w-6xl" : "max-w-3xl lg:max-w-4xl xl:max-w-5xl"
        )}>
          {currentStep === 0 && renderStep1()}
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
          {currentStep === 3 && renderStep4()}
          {currentStep === 4 && renderStep5()}
        </div>

        {/* Sticky bottom action bar */}
        <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t shadow-xl">
          <div className="px-3 py-3 flex gap-2.5 items-center max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto">
            {/* Step counter */}
            <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
              {currentStep + 1} / {stepLabels.length}
            </span>

            <div className="flex-1" />

            {/* Back */}
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="h-[52px] px-5 gap-1.5 font-medium"
            >
              <PrevIcon className="h-4 w-4" />
              {t("seller_products.wizard_back")}
            </Button>

            {/* Next / Publish */}
            {!isLastStep ? (
              <Button
                type="button"
                onClick={handleNext}
                className="h-[52px] px-6 gap-1.5 font-semibold flex-1 sm:flex-none sm:min-w-[160px]"
              >
                {t("seller_products.wizard_next")}
                <NextIcon className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isPending}
                className="h-[52px] px-6 font-semibold flex-1 sm:flex-none sm:min-w-[180px] bg-primary hover:bg-primary/90"
              >
                {isPending
                  ? (mode === "new" ? t("seller_products.creating") : t("seller_products.saving"))
                  : (mode === "new" ? t("seller_products.wizard_publish") : t("seller_products.wizard_save"))}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
