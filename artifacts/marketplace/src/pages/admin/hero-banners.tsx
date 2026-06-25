/**
 * Admin — Hero Banner Management
 * Full CRUD + scheduling + analytics dashboard
 */
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Image as ImageIcon,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  BarChart3,
  MousePointerClick,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Calendar,
  ExternalLink,
  X,
  Sparkles,
  ArrowUpRight,
  Monitor,
  Smartphone,
  ScanEye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Banner {
  id: number;
  titleAr: string;
  titleEn: string;
  subtitleAr: string | null;
  subtitleEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  desktopImage: string;
  mobileImage: string | null;
  ctaLabelAr: string | null;
  ctaLabelEn: string | null;
  ctaUrl: string | null;
  ctaLabelArSecondary: string | null;
  ctaLabelEnSecondary: string | null;
  ctaUrlSecondary: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  slot: string;
  sortOrder: number;
  impressions: number;
  clicks: number;
  ctr?: number;
  createdAt: string;
  updatedAt: string;
}

interface Analytics {
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
  topBanner: Banner | null;
  worstBanner: Banner | null;
  banners: Banner[];
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL ?? "/";

function apiFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${BASE}api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const EMPTY: Partial<Banner> = {
  titleAr: "",
  titleEn: "",
  subtitleAr: "",
  subtitleEn: "",
  descriptionAr: "",
  descriptionEn: "",
  desktopImage: "",
  mobileImage: "",
  ctaLabelAr: "",
  ctaLabelEn: "",
  ctaUrl: "",
  ctaLabelArSecondary: "",
  ctaLabelEnSecondary: "",
  ctaUrlSecondary: "",
  backgroundColor: "#0f172a",
  textColor: "#ffffff",
  active: true,
  slot: "main",
  sortOrder: 0,
  startDate: null,
  endDate: null,
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ─── Banner status badge ──────────────────────────────────────────────────────

function StatusBadge({ banner }: { banner: Banner }) {
  const now = new Date();
  const start = banner.startDate ? new Date(banner.startDate) : null;
  const end = banner.endDate ? new Date(banner.endDate) : null;

  if (!banner.active) return <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inactive</span>;
  if (start && start > now) return <span className="text-xs bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full">Scheduled</span>;
  if (end && end < now) return <span className="text-xs bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full">Expired</span>;
  return <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">Live</span>;
}

// ─── Form field ───────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Banner preview render ────────────────────────────────────────────────────
// Renders a visual preview of a banner (used inside BannerPreviewModal).
// Not a full HeroBannerCarousel — a faithful but lightweight standalone render.

function BannerPreviewRender({
  banner,
  isMobile = false,
}: {
  banner: Partial<Banner>;
  isMobile?: boolean;
}) {
  const textColor  = banner.textColor  ?? "#ffffff";
  const bgColor    = banner.backgroundColor ?? "#0a150a";
  const imgSrc     = isMobile && banner.mobileImage ? banner.mobileImage : (banner.desktopImage ?? "");
  const title      = banner.titleEn    || banner.titleAr    || "";
  const subtitle   = banner.subtitleEn || banner.subtitleAr || "";
  const desc       = banner.descriptionEn || banner.descriptionAr || "";
  const ctaLabel   = banner.ctaLabelEn || banner.ctaLabelAr || "";
  const ctaLabel2  = banner.ctaLabelEnSecondary || banner.ctaLabelArSecondary || "";

  const height = isMobile ? 220 : 420;

  return (
    <div style={{
      position: "relative", width: "100%", height,
      overflow: "hidden", borderRadius: isMobile ? 0 : 12,
      background: bgColor,
    }}>
      {/* Background image */}
      {imgSrc && (
        <img src={imgSrc} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
      )}

      {/* Overlay — spec gradient */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 100%)" }} />
      {/* Side darkening for content legibility */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.70) 0%, transparent 58%)" }} />

      {/* Floating card mockup (desktop only) */}
      {!isMobile && (
        <div style={{
          position: "absolute", top: 28, right: 24, zIndex: 10,
          background: "rgba(6,6,6,0.92)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 13,
          padding: "9px 12px", display: "flex", gap: 9, alignItems: "center",
          boxShadow: "0 16px 44px rgba(0,0,0,0.75)", width: 168, direction: "rtl",
        }}>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontSize: 9.5, color: "#5a626e", marginBottom: 2 }}>منتج مميز</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f3f3f3" }}>
              250,000 <span style={{ color: "#276221", fontSize: 9 }}>ل.س</span>
            </div>
            <div style={{ display: "flex", gap: 1.5, justifyContent: "flex-end", marginTop: 2 }}>
              {[0,1,2,3,4].map(i => <span key={i} style={{ fontSize: 8.5, color: "#f59e0b" }}>★</span>)}
            </div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(39,98,33,0.20)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🛍</div>
        </div>
      )}

      {/* Content */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        paddingLeft: isMobile ? 20 : 36, paddingRight: isMobile ? 20 : 8,
        zIndex: 20,
      }}>
        <div style={{ maxWidth: isMobile ? "88%" : "52%", display: "flex", flexDirection: "column", gap: isMobile ? 8 : 11 }}>
          {subtitle && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 11px", borderRadius: 100,
              border: "1px solid rgba(39,98,33,0.40)",
              color: "#4ade80", fontSize: isMobile ? 9.5 : 11, fontWeight: 700,
              background: "rgba(39,98,33,0.12)",
              alignSelf: "flex-start",
            }}>
              ✦ {subtitle}
            </span>
          )}
          {title && (
            <div style={{
              color: textColor, fontWeight: 900, lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontSize: isMobile ? "clamp(1.1rem,5vw,1.5rem)" : "clamp(1.5rem,3vw,2.4rem)",
            }}>
              {title}
            </div>
          )}
          {desc && !isMobile && (
            <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12.5, lineHeight: 1.6, maxWidth: 400 }}>
              {desc}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ctaLabel && (
              <span style={{
                background: "#276221", color: "#fff",
                padding: isMobile ? "6px 14px" : "8px 18px",
                borderRadius: 8, fontWeight: 700,
                fontSize: isMobile ? 11 : 13,
              }}>
                {ctaLabel} →
              </span>
            )}
            {ctaLabel2 && !isMobile && (
              <span style={{
                background: "rgba(255,255,255,0.10)", color: "#fff",
                padding: "8px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13,
                border: "1px solid rgba(255,255,255,0.18)",
              }}>
                {ctaLabel2}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar (desktop only) */}
      {!isMobile && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", background: "rgba(0,0,0,0.28)", backdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(255,255,255,0.06)", zIndex: 20,
        }}>
          {[["12,000+","Customers"], ["25,000+","Products"], ["500+","Stores"]].map(([n, l]) => (
            <div key={l} style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 12.5 }}>{n}</div>
              <div style={{ color: "rgba(255,255,255,0.50)", fontSize: 9.5 }}>{l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Banner preview modal ─────────────────────────────────────────────────────

function BannerPreviewModal({
  open,
  onClose,
  banner,
}: {
  open: boolean;
  onClose: () => void;
  banner: Partial<Banner> | null;
}) {
  if (!banner) return null;

  const title = banner.titleEn || banner.titleAr || "Untitled Banner";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[98vw] max-w-6xl p-0 overflow-hidden gap-0">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="flex-row items-center justify-between px-5 py-3 border-b bg-muted/30 space-y-0">
          <div className="flex items-center gap-2">
            <ScanEye className="h-4 w-4 text-primary" />
            <DialogTitle className="text-sm font-semibold truncate max-w-xs">
              Preview — {title}
            </DialogTitle>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* ── Two-panel layout: Desktop | Mobile ─────────────────────── */}
        <div className="flex gap-0 divide-x divide-border bg-muted/10 overflow-auto">

          {/* ── Desktop view ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* View label */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desktop</span>
              <span className="text-xs text-muted-foreground ms-auto">≥ 1024px</span>
            </div>
            {/* Browser chrome */}
            <div className="p-4 flex flex-col flex-1">
              {/* Chrome bar */}
              <div className="rounded-t-lg bg-muted border border-border border-b-0 flex items-center gap-2 px-3 py-2">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <div className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-[10px] text-muted-foreground text-center truncate">
                  syanomarket.online
                </div>
              </div>
              {/* Navbar mock */}
              <div className="border border-border border-t-0 border-b-0 bg-background px-3 py-2 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                    <span className="text-[8px] font-black text-primary-foreground">S</span>
                  </div>
                  <span className="text-[10px] font-black">SYANO</span>
                </div>
                <div className="flex-1 h-4 bg-muted rounded-md mx-2" />
                <div className="w-12 h-4 bg-muted rounded" />
              </div>
              {/* Page container */}
              <div className="border border-border border-t-0 rounded-b-lg bg-background pb-3 px-2">
                <BannerPreviewRender banner={banner} isMobile={false} />
              </div>
            </div>
          </div>

          {/* ── Mobile view ──────────────────────────────────────────── */}
          <div className="w-[300px] shrink-0 flex flex-col">
            {/* View label */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mobile</span>
              <span className="text-xs text-muted-foreground ms-auto">375px</span>
            </div>
            {/* Phone frame */}
            <div className="flex items-start justify-center py-5 px-4 bg-muted/20 flex-1">
              <div style={{
                background: "hsl(var(--card))",
                borderRadius: 32,
                padding: "10px 6px 14px",
                boxShadow: "0 0 0 5px hsl(var(--border)), 0 20px 60px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.04)",
                width: 260,
              }}>
                {/* Notch */}
                <div className="flex justify-center mb-2">
                  <div style={{ width: 72, height: 14, background: "hsl(var(--border))", borderRadius: 100 }} />
                </div>
                {/* Screen */}
                <div style={{ borderRadius: 22, overflow: "hidden", border: "1px solid hsl(var(--border))" }}>
                  {/* Mobile navbar mock */}
                  <div className="bg-background flex items-center gap-1.5 px-2.5 py-1.5">
                    <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
                      <span className="text-[7px] font-black text-primary-foreground">S</span>
                    </div>
                    <span className="text-[9px] font-black">SYANO</span>
                    <div className="flex-1 h-3 bg-muted rounded ms-1" />
                  </div>
                  {/* Banner */}
                  <BannerPreviewRender banner={banner} isMobile={true} />
                  {/* Page mock below banner */}
                  <div className="bg-background p-2 space-y-1.5">
                    <div className="h-2 bg-muted rounded w-3/4" />
                    <div className="grid grid-cols-2 gap-1">
                      <div className="h-10 bg-muted rounded" />
                      <div className="h-10 bg-muted rounded" />
                    </div>
                  </div>
                </div>
                {/* Home indicator */}
                <div className="flex justify-center mt-2.5">
                  <div style={{ width: 48, height: 4, background: "hsl(var(--border))", borderRadius: 100 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Preview reflects saved image URL and current form data. Floating cards use real products on the live site.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Banner form dialog ───────────────────────────────────────────────────────

function BannerDialog({
  open,
  onClose,
  initial,
  token,
  onSaved,
  onPreview,
}: {
  open: boolean;
  onClose: () => void;
  initial: Partial<Banner>;
  token: string;
  onSaved: () => void;
  onPreview: (banner: Partial<Banner>) => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [form, setForm] = useState<Partial<Banner>>(initial);
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial.id;

  const set = (key: keyof Banner, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.titleEn?.trim() || !form.titleAr?.trim()) {
      toast({ title: t("admin.hero_banners.title_required"), variant: "destructive" });
      return;
    }
    if (!form.desktopImage?.trim()) {
      toast({ title: t("admin.hero_banners.image_required"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const method = isEdit ? "PATCH" : "POST";
      const path = isEdit ? `/admin/banners/${initial.id}` : "/admin/banners";
      const res = await apiFetch(path, token, { method, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Failed");
      toast({ title: isEdit ? t("admin.hero_banners.save_success_edit") : t("admin.hero_banners.save_success_create") });
      onSaved();
      onClose();
    } catch {
      toast({ title: t("admin.hero_banners.save_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[90vw] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("admin.hero_banners.edit_banner") : t("admin.hero_banners.new_banner")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Titles */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title (English)" className="col-span-1">
              <Input value={form.titleEn ?? ""} onChange={(e) => set("titleEn", e.target.value)} placeholder="Summer Sale" />
            </Field>
            <Field label="العنوان (عربي)" className="col-span-1">
              <Input value={form.titleAr ?? ""} onChange={(e) => set("titleAr", e.target.value)} placeholder="تخفيضات الصيف" dir="rtl" />
            </Field>
          </div>

          {/* Subtitles */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subtitle (EN)">
              <Input value={form.subtitleEn ?? ""} onChange={(e) => set("subtitleEn", e.target.value)} placeholder="Limited time offer" />
            </Field>
            <Field label="عنوان فرعي (AR)">
              <Input value={form.subtitleAr ?? ""} onChange={(e) => set("subtitleAr", e.target.value)} placeholder="عرض محدود" dir="rtl" />
            </Field>
          </div>

          {/* Descriptions */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Description (EN)">
              <textarea
                value={form.descriptionEn ?? ""}
                onChange={(e) => set("descriptionEn", e.target.value)}
                placeholder="Up to 50% off on electronics..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="الوصف (AR)">
              <textarea
                value={form.descriptionAr ?? ""}
                onChange={(e) => set("descriptionAr", e.target.value)}
                placeholder="خصومات تصل إلى 50%..."
                dir="rtl"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Field label="Desktop Image URL *">
              <Input value={form.desktopImage ?? ""} onChange={(e) => set("desktopImage", e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Mobile Image URL (optional)">
              <Input value={form.mobileImage ?? ""} onChange={(e) => set("mobileImage", e.target.value || null)} placeholder="https://..." />
            </Field>
          </div>

          {/* Primary CTA */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary CTA</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Label (EN)">
                <Input value={form.ctaLabelEn ?? ""} onChange={(e) => set("ctaLabelEn", e.target.value || null)} placeholder="Shop Now" />
              </Field>
              <Field label="Label (AR)">
                <Input value={form.ctaLabelAr ?? ""} onChange={(e) => set("ctaLabelAr", e.target.value || null)} placeholder="تسوق الآن" dir="rtl" />
              </Field>
              <Field label="URL">
                <Input value={form.ctaUrl ?? ""} onChange={(e) => set("ctaUrl", e.target.value || null)} placeholder="/products" />
              </Field>
            </div>
          </div>

          {/* Secondary CTA */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Secondary CTA (optional)</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Label (EN)">
                <Input value={form.ctaLabelEnSecondary ?? ""} onChange={(e) => set("ctaLabelEnSecondary", e.target.value || null)} placeholder="Learn More" />
              </Field>
              <Field label="Label (AR)">
                <Input value={form.ctaLabelArSecondary ?? ""} onChange={(e) => set("ctaLabelArSecondary", e.target.value || null)} placeholder="اعرف أكثر" dir="rtl" />
              </Field>
              <Field label="URL">
                <Input value={form.ctaUrlSecondary ?? ""} onChange={(e) => set("ctaUrlSecondary", e.target.value || null)} placeholder="/about" />
              </Field>
            </div>
          </div>

          {/* Colors + schedule */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Background Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.backgroundColor ?? "#0f172a"}
                  onChange={(e) => set("backgroundColor", e.target.value)}
                  className="h-9 w-9 rounded border border-input cursor-pointer shrink-0"
                />
                <Input value={form.backgroundColor ?? "#0f172a"} onChange={(e) => set("backgroundColor", e.target.value)} className="font-mono text-xs" />
              </div>
            </Field>
            <Field label="Text Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.textColor ?? "#ffffff"}
                  onChange={(e) => set("textColor", e.target.value)}
                  className="h-9 w-9 rounded border border-input cursor-pointer shrink-0"
                />
                <Input value={form.textColor ?? "#ffffff"} onChange={(e) => set("textColor", e.target.value)} className="font-mono text-xs" />
              </div>
            </Field>
          </div>

          {/* Banner Slot */}
          <Field label="Banner Slot / موقع البانر">
            <select
              value={form.slot ?? "main"}
              onChange={(e) => set("slot", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="main">Banner A — Main Slider (carousel)</option>
              <option value="side_b">Banner B — Side Panel Top-Right (static)</option>
              <option value="side_c">Banner C — Side Panel Bottom-Right (static)</option>
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Sort Order">
              <Input
                type="number"
                value={form.sortOrder ?? 0}
                onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)}
                min={0}
              />
            </Field>
            <Field label="Start Date (UTC)">
              <Input
                type="datetime-local"
                value={form.startDate ? new Date(form.startDate).toISOString().slice(0, 16) : ""}
                onChange={(e) => set("startDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
            </Field>
            <Field label="End Date (UTC)">
              <Input
                type="datetime-local"
                value={form.endDate ? new Date(form.endDate).toISOString().slice(0, 16) : ""}
                onChange={(e) => set("endDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
            </Field>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set("active", !form.active)}
              className={cn(
                "relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                form.active ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-md transition-transform mt-0.5",
                  form.active ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
            <span className="text-sm font-medium">{form.active ? "Active" : "Inactive"}</span>
          </div>
        </div>

        {/* Image preview */}
        {form.desktopImage && (
          <div className="rounded-lg border overflow-hidden mt-2">
            <p className="text-xs text-muted-foreground px-3 pt-2 pb-1">Preview</p>
            <img
              src={form.desktopImage}
              alt="Banner preview"
              className="w-full h-32 object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="outline"
            className="flex items-center gap-1.5 px-4"
            type="button"
            onClick={() => onPreview(form)}
          >
            <ScanEye className="h-3.5 w-3.5" />
            {t("admin.hero_banners.live_preview")}
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? t("common.submitting") : isEdit ? t("admin.hero_banners.save_changes") : t("admin.hero_banners.create_banner")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminHeroBanners() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBanner, setEditBanner] = useState<Partial<Banner>>(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [previewBanner, setPreviewBanner] = useState<Partial<Banner> | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: banners = [], isLoading } = useQuery<Banner[]>({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const r = await apiFetch("/admin/banners", token!);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!token,
  });

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ["admin-banners-analytics"],
    queryFn: async () => {
      const r = await apiFetch("/admin/banners/analytics", token!);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!token,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    queryClient.invalidateQueries({ queryKey: ["admin-banners-analytics"] });
  };

  // ── Toggle active ────────────────────────────────────────────────────────
  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const r = await apiFetch(`/admin/banners/${id}`, token!, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: invalidate,
    onError: () => toast({ title: t("admin.hero_banners.toggle_error"), variant: "destructive" }),
  });

  // ── Reorder ──────────────────────────────────────────────────────────────
  const reorder = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: number; sortOrder: number }) => {
      const r = await apiFetch(`/admin/banners/${id}`, token!, {
        method: "PATCH",
        body: JSON.stringify({ sortOrder }),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: invalidate,
  });

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteBanner = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`/admin/banners/${id}`, token!, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: t("admin.hero_banners.delete_success") });
      setDeleteConfirm(null);
      invalidate();
    },
    onError: () => toast({ title: t("admin.hero_banners.delete_error"), variant: "destructive" }),
  });

  const openCreate = () => { setEditBanner({ ...EMPTY }); setDialogOpen(true); };
  const openEdit = (b: Banner) => { setEditBanner({ ...b }); setDialogOpen(true); };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              {t("admin.hero_banners.page_title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("admin.hero_banners.page_subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 me-1.5" />
                {t("admin.hero_banners.preview_homepage")}
              </a>
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 me-1.5" />
              {t("admin.hero_banners.new_banner")}
            </Button>
          </div>
        </div>

        {/* Analytics stats */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Eye className="h-5 w-5 text-blue-600" />}
              label="Total Impressions"
              value={analytics.totalImpressions.toLocaleString()}
              color="bg-blue-500/10"
            />
            <StatCard
              icon={<MousePointerClick className="h-5 w-5 text-primary" />}
              label="Total Clicks"
              value={analytics.totalClicks.toLocaleString()}
              color="bg-primary/10"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-violet-600" />}
              label="Overall CTR"
              value={`${analytics.overallCtr}%`}
              color="bg-violet-500/10"
            />
            <StatCard
              icon={<BarChart3 className="h-5 w-5 text-amber-600" />}
              label="Total Banners"
              value={banners.length}
              color="bg-amber-500/10"
            />
          </div>
        )}

        {/* Top/Worst performers */}
        {analytics && (analytics.topBanner || analytics.worstBanner) && banners.length > 1 && (
          <div className="grid grid-cols-2 gap-3">
            {analytics.topBanner && (
              <div className="rounded-xl border p-3 bg-primary/5 border-primary/20">
                <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-2">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Top Performer
                </p>
                <p className="font-semibold text-sm line-clamp-1">
                  {lang === "ar" ? analytics.topBanner.titleAr : analytics.topBanner.titleEn}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {analytics.topBanner.ctr?.toFixed(2)}% CTR · {analytics.topBanner.impressions.toLocaleString()} impressions
                </p>
              </div>
            )}
            {analytics.worstBanner && (
              <div className="rounded-xl border p-3">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Needs Attention
                </p>
                <p className="font-semibold text-sm line-clamp-1">
                  {lang === "ar" ? analytics.worstBanner.titleAr : analytics.worstBanner.titleEn}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {analytics.worstBanner.ctr?.toFixed(2)}% CTR · {analytics.worstBanner.impressions.toLocaleString()} impressions
                </p>
              </div>
            )}
          </div>
        )}

        {/* Banners list */}
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">All Banners</h2>
            <span className="text-xs text-muted-foreground">{banners.length} total</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : banners.length === 0 ? (
            <div className="p-10 text-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">No banners yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first banner to replace the static hero.</p>
              <Button size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5 me-1.5" />
                Create Banner
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {banners.map((banner, idx) => (
                <div key={banner.id} className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors">
                  {/* Thumbnail */}
                  <div className="h-14 w-20 rounded-lg overflow-hidden border shrink-0 bg-muted">
                    <img
                      src={banner.desktopImage}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate max-w-[160px]">
                        {lang === "ar" ? banner.titleAr : banner.titleEn}
                      </span>
                      <StatusBadge banner={banner} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {banner.impressions.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        {banner.clicks.toLocaleString()}
                      </span>
                      {banner.impressions > 0 && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {((banner.clicks / banner.impressions) * 100).toFixed(1)}%
                        </span>
                      )}
                      {(banner.startDate || banner.endDate) && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sort controls */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      disabled={idx === 0}
                      onClick={() => reorder.mutate({ id: banner.id, sortOrder: banner.sortOrder - 1 })}
                      className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      disabled={idx === banners.length - 1}
                      onClick={() => reorder.mutate({ id: banner.id, sortOrder: banner.sortOrder + 1 })}
                      className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive.mutate({ id: banner.id, active: !banner.active })}
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                        banner.active
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                      aria-label={banner.active ? "Deactivate" : "Activate"}
                      title={banner.active ? "Deactivate" : "Activate"}
                    >
                      {banner.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setPreviewBanner(banner)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Live Preview"
                      title="Live Preview"
                    >
                      <ScanEye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEdit(banner)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Edit"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(banner.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hint */}
        <p className="text-xs text-muted-foreground text-center">
          Banners display on the homepage in sort order. Only active, scheduled banners are shown publicly.
        </p>
      </div>

      {/* Create/Edit dialog */}
      <BannerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editBanner}
        token={token!}
        onSaved={invalidate}
        onPreview={(b) => { setDialogOpen(false); setPreviewBanner(b); }}
      />

      {/* Live preview modal */}
      <BannerPreviewModal
        open={previewBanner !== null}
        onClose={() => setPreviewBanner(null)}
        banner={previewBanner}
      />

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="w-[90vw] max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete Banner?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All analytics data for this banner will also be lost.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteBanner.isPending}
              onClick={() => deleteConfirm !== null && deleteBanner.mutate(deleteConfirm)}
            >
              {deleteBanner.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
