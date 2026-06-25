import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES } from "@/lib/categories";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Store, Save } from "lucide-react";

function useApplySchema() {
  const { t } = useTranslation();
  return z.object({
    storeName: z.string().min(2, t("seller_apply.name_min")).max(100),
    phone: z.string().min(5, t("seller_apply.phone_required")),
    city: z.string().min(2, t("seller_apply.city_required")),
    categories: z.array(z.string()).min(1, t("seller_apply.categories_required")),
    description: z.string().min(10, t("seller_apply.desc_min")),
    address: z.string().optional(),
    website: z.string().optional(),
    socialLinks: z.string().optional(),
    businessInfo: z.string().optional(),
  });
}

type ApplyFormValues = {
  storeName: string;
  phone: string;
  city: string;
  categories: string[];
  description: string;
  address?: string;
  website?: string;
  socialLinks?: string;
  businessInfo?: string;
};

/** Statuses that should redirect to the application-status page */
const ACTIVE_STATUSES = ["pending", "under_review", "approved", "suspended"];

export default function SellerApply() {
  const { user, token, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  useSEO({
    title: lang === "ar" ? "أصبح بائعاً على سيانو — ابدأ متجرك اليوم" : "Become a Seller on Syano — Start Your Store Today",
    description: lang === "ar"
      ? "سجّل متجرك على سيانو وابدأ البيع لآلاف العملاء في سوريا. إجراءات بسيطة، عمولات منافسة، دعم كامل."
      : "Open your store on Syano and reach thousands of customers across Syria. Simple setup, competitive commissions, full seller support.",
    canonical: "/seller/apply",
  });
  const queryClient = useQueryClient();

  const applySchema = useApplySchema();

  const { data: existingApp, isLoading: checkingApp } = useQuery({
    queryKey: ["seller-application", "my"],
    queryFn: async () => {
      const res = await fetch("/api/seller-applications/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) { navigate("/login"); return; }
    if (user?.role === "seller") { navigate("/seller/dashboard"); return; }
  }, [isAuthenticated, user]);

  useEffect(() => {
    // Redirect to status page only for active (non-draft) applications
    if (!checkingApp && existingApp && ACTIVE_STATUSES.includes(existingApp.status)) {
      navigate("/seller/application-status");
    }
  }, [existingApp, checkingApp]);

  const form = useForm<ApplyFormValues>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      storeName: "",
      phone: "",
      city: "",
      categories: [],
      description: "",
      address: "",
      website: "",
      socialLinks: "",
      businessInfo: "",
    },
  });

  // Pre-populate form when a draft is loaded
  const draftPopulated = useRef(false);
  useEffect(() => {
    if (!checkingApp && existingApp?.status === "draft" && !draftPopulated.current) {
      draftPopulated.current = true;
      form.reset({
        storeName:   existingApp.storeName   || "",
        phone:       existingApp.phone       || "",
        city:        existingApp.city        || "",
        categories:  existingApp.categories  || [],
        description: existingApp.description || "",
        address:     existingApp.address     || "",
        website:     existingApp.website     || "",
        socialLinks: existingApp.socialLinks || "",
        businessInfo: existingApp.businessInfo || "",
      });
    }
  }, [checkingApp, existingApp]);

  /* ── Save Draft ───────────────────────────────────────────── */
  const saveDraftMutation = useMutation({
    mutationFn: async (data: Partial<ApplyFormValues>) => {
      const res = await fetch("/api/seller-applications/draft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save draft");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-application", "my"] });
      toast({ title: t("seller.draft_saved") });
    },
    onError: (e: any) => {
      toast({ title: t("seller.save_failed"), description: e.message, variant: "destructive" });
    },
  });

  const handleSaveDraft = () => {
    saveDraftMutation.mutate(form.getValues());
  };

  /* ── Final Submit ─────────────────────────────────────────── */
  const submitMutation = useMutation({
    mutationFn: async (data: ApplyFormValues) => {
      const res = await fetch("/api/seller-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("common.error"));
      }
      return res.json();
    },
    onSuccess: (newApp) => {
      // Seed the cache immediately with the fresh application so the status
      // page never sees a null value during the refetch window.
      queryClient.setQueryData(["seller-application", "my"], newApp);
      queryClient.invalidateQueries({ queryKey: ["seller-application", "my"] });
      toast({
        title: t("seller_apply.submitted_title"),
        description: t("seller_apply.submitted_desc"),
      });
      navigate("/seller/application-status");
    },
    onError: (e: any) => {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    },
  });

  if (checkingApp) {
    return (
      <Layout>
        <div className="container py-12 flex justify-center">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        </div>
      </Layout>
    );
  }

  // After successful submission, show a redirect indicator so the form is
  // never visible again — the navigate() in onSuccess handles the actual
  // transition, but this prevents any re-render from flashing the form.
  if (submitMutation.isSuccess) {
    return (
      <Layout>
        <div className="container py-12 flex justify-center">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        </div>
      </Layout>
    );
  }

  const isDraft = existingApp?.status === "draft";
  const isRejected = existingApp?.status === "rejected";

  const steps = [
    { n: 1, label: t("seller_apply.step_1"), active: true },
    { n: 2, label: t("seller_apply.step_2") },
    { n: 3, label: t("seller_apply.step_3") },
  ];

  const selectedCategories = form.watch("categories") ?? [];

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{t("seller_apply.page_title")}</h1>
          <p className="text-muted-foreground">{t("seller_apply.page_subtitle")}</p>

          {/* Status badges */}
          {isDraft && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground border">
              <Save className="h-3 w-3" />
              {t("seller.draft_saved_banner")}
            </div>
          )}
          {isRejected && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-xs font-medium text-red-600 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800">
              {t("seller.rejected_banner")}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.map(({ n, label, active }, i) => (
            <div key={n} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-border" />}
              <div className="flex items-center gap-1.5 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {n}
                </div>
                <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))}
            className="space-y-5"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("seller_apply.store_info_title")}</CardTitle>
                <CardDescription>{t("seller_apply.store_info_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="storeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("seller_apply.store_name")}{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={t("seller_apply.store_name_placeholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("seller_apply.phone")}{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={t("seller_apply.phone_placeholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("seller_apply.city")}{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={t("seller_apply.city_placeholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Multi-category selection */}
                <Controller
                  control={form.control}
                  name="categories"
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium leading-none">
                          {t("seller_apply.categories")}{" "}
                          <span className="text-destructive">*</span>
                        </span>
                        {selectedCategories.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            {t("seller.categories_selected", { count: selectedCategories.length })}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t("seller_apply.categories_hint")}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {CATEGORIES.map((cat) => {
                          const checked = field.value?.includes(cat.slug) ?? false;
                          return (
                            <button
                              key={cat.slug}
                              type="button"
                              onClick={() => {
                                const current = field.value ?? [];
                                field.onChange(
                                  checked
                                    ? current.filter((c) => c !== cat.slug)
                                    : [...current, cat.slug]
                                );
                              }}
                              className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-start transition-colors ${
                                checked
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-foreground hover:bg-muted"
                              }`}
                            >
                              <div
                                aria-hidden="true"
                                className={`shrink-0 mt-0.5 h-3.5 w-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                                  checked ? "bg-primary border-primary" : "border-border bg-background"
                                }`}
                              >
                                {checked && (
                                  <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="2,5 4.5,7.5 8,2.5" />
                                  </svg>
                                )}
                              </div>
                              <span className="leading-snug">{lang === "ar" ? cat.ar : cat.en}</span>
                            </button>
                          );
                        })}
                      </div>
                      {fieldState.error && (
                        <p className="text-sm font-medium text-destructive">{fieldState.error.message}</p>
                      )}
                    </div>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("seller_apply.description")}{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("seller_apply.description_placeholder")}
                          className="min-h-[100px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t("seller_apply.description_hint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {t("seller_apply.extra_title")}
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {t("seller_apply.optional_badge")}
                  </Badge>
                </CardTitle>
                <CardDescription>{t("seller_apply.extra_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("seller_apply.address")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("seller_apply.address_placeholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("seller_apply.website")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("seller_apply.website_placeholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="socialLinks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("seller_apply.social")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("seller_apply.social_placeholder")}
                          className="min-h-[70px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("seller_apply.business_info")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("seller_apply.business_info_placeholder")}
                          className="min-h-[70px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="sm:flex-1 h-11 gap-2"
                onClick={handleSaveDraft}
                disabled={saveDraftMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {saveDraftMutation.isPending
                  ? t("seller.saving")
                  : t("seller.save_draft")}
              </Button>
              <Button
                type="submit"
                className="sm:flex-2 h-11 text-base font-semibold"
                disabled={submitMutation.isPending || submitMutation.isSuccess}
              >
                {submitMutation.isPending
                  ? t("seller_apply.submitting")
                  : t("seller_apply.submit_btn")}
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {lang === "ar"
                ? "يمكنك حفظ التقدم في أي وقت والعودة لإكماله لاحقاً."
                : "You can save your progress at any time and return to complete it later."}
            </p>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
