import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import {
  useUpdateProduct, useGetProduct,
  getListProductsQueryKey, getGetProductQueryKey, getGetSellerDashboardQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProductWizard, type WizardPayload } from "@/components/ProductWizard";
import { buildVariantPayload } from "@/components/VariantBuilder";
import { useState } from "react";

export default function EditProduct() {
  const params = useParams();
  const id = parseInt(String(params.id || "0"), 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const [isSaving, setIsSaving] = useState(false);

  const { data: product, isLoading } = useGetProduct(id, {
    query: { queryKey: getGetProductQueryKey(id), enabled: !!id },
  });

  const updateProduct = useUpdateProduct();

  const handleSubmit = async (payload: WizardPayload) => {
    const { formData, galleryUrls, discountPct, variantsEnabled, variantGroups, variantRows, specs } = payload;

    if (isSaving) return;
    setIsSaving(true);

    try {
      const specLines = specs
        .filter(s => s.key.trim() && s.value.trim())
        .map(s => `${s.key.trim()}: ${s.value.trim()}`);
      const fullDesc = specLines.length > 0
        ? [...specLines, "", formData.description].join("\n").trim()
        : formData.description;

      const cleanGallery = galleryUrls.filter(u => {
        try { new URL(u); return true; } catch { return false; }
      });

      await updateProduct.mutateAsync({
        id,
        data: {
          ...formData,
          price: Number(formData.price),
          stock: Number(formData.stock),
          description: fullDesc,
          subcategory: formData.subcategory || null,
          imageUrl: formData.imageUrl || null,
          imageUrls: cleanGallery.length > 0 ? cleanGallery : null,
        } as any,
      });

      const discResp = await fetch(`/api/products/${id}/discount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ discountPercent: discountPct > 0 ? discountPct : null }),
      });
      if (!discResp.ok) {
        const err = await discResp.json().catch(() => ({}));
        toast({ title: t("seller_products.discount_update_failed"), description: (err as any).message ?? "", variant: "destructive" });
        return;
      }

      if (variantsEnabled && variantGroups.length > 0 && variantRows.length > 0) {
        const vResp = await fetch(`/api/products/${id}/variants/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
          body: JSON.stringify(buildVariantPayload(variantGroups, variantRows)),
        });
        if (!vResp.ok) {
          const err = await vResp.json().catch(() => ({}));
          toast({ title: t("variants.save_failed", "Failed to save variants"), description: (err as any).error ?? "", variant: "destructive" });
          return;
        }
      } else if (!variantsEnabled) {
        await fetch(`/api/products/${id}/variants`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
      }

      toast({ title: t("seller_products.updated") });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetSellerDashboardQueryKey() });
      setLocation("/seller/products");
    } catch (err: any) {
      toast({ title: t("seller_products.update_failed"), description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-12 text-center text-muted-foreground">{t("common.loading")}</div>
      </Layout>
    );
  }

  const initialData = product ? {
    name: product.name,
    description: product.description || "",
    price: product.price,
    category: product.category || "",
    subcategory: (product as any).subcategory || "",
    stock: product.stock,
    imageUrl: product.imageUrl || "",
    imageUrls: product.imageUrls ?? [],
    discountPercent: product.discountPercent ?? 0,
    variantGroups: (product as any).variantGroups ?? [],
    variants: (product as any).variants ?? [],
  } : undefined;

  return (
    <Layout>
      <div className="w-full">
        {/* Back + title */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b bg-background">
          <Link href="/seller/products">
            <button
              type="button"
              className="h-9 w-9 rounded-xl border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors touch-manipulation shrink-0"
            >
              <BackIcon className="h-4 w-4" />
            </button>
          </Link>
          <h1 className="text-lg font-bold tracking-tight flex-1 min-w-0 truncate">
            {t("seller_products.edit_title")}
          </h1>
        </div>

        <ProductWizard
          mode="edit"
          isPending={isSaving}
          onSubmit={handleSubmit}
          initialData={initialData}
          existingStock={product?.stock}
        />
      </div>
    </Layout>
  );
}
