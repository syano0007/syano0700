import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListProducts, useDeleteProduct, getListProductsQueryKey, getGetSellerDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Edit, Trash2, Plus, PackageOpen, Search, X, Package, TrendingDown, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QualityReport {
  total_products: number;
  flagged_count: number;
  products: Array<{ id: number; name: string; name_ar: string; issues: string[] }>;
}

export default function SellerProducts() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { format } = useCurrency();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [qualityDismissed, setQualityDismissed] = useState(false);

  const { data: products = [], isLoading } = useListProducts(
    { sellerId: user?.id },
    {
      query: {
        queryKey: getListProductsQueryKey({ sellerId: user?.id }),
        enabled: !!user?.id,
      },
    }
  );

  const { data: qualityReport } = useQuery<QualityReport>({
    queryKey: ["seller-product-quality", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/seller/products/quality-report", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const qualityMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const p of qualityReport?.products ?? []) {
      map.set(p.id, p.issues);
    }
    return map;
  }, [qualityReport]);

  const deleteProduct = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: t("seller_products.deleted") });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSellerDashboardQueryKey() });
        setDeleteId(null);
      },
      onError: () => {
        toast({ title: t("seller_products.delete_failed"), variant: "destructive" });
        setDeleteId(null);
      },
    },
  });

  const filtered = useMemo(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    if (stockFilter === "low") list = list.filter((p) => p.stock > 0 && p.stock <= 5);
    if (stockFilter === "out") list = list.filter((p) => p.stock === 0);
    if (stockFilter === "in")  list = list.filter((p) => p.stock > 5);
    return list;
  }, [products, search, stockFilter]);

  const inStockCount  = products.filter((p) => p.stock > 5).length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const stockBadge = (stock: number) => {
    if (stock === 0) return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-[10px] font-bold">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        {t("inventory.out_of_stock")}
      </span>
    );
    if (stock <= 5) return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 text-[10px] font-bold">
        <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
        {stock}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 text-[10px] font-bold">
        {stock}
      </span>
    );
  };

  return (
    <Layout>
      <SellerNav />
      <div className="container py-6 md:py-10 max-w-6xl">

        {/* ── Data Quality Banner ── */}
        {!qualityDismissed && qualityReport && qualityReport.flagged_count > 0 && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{t("seller.quality.banner_title")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("seller.quality.banner_subtitle", { count: qualityReport.flagged_count })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setQualityDismissed(true)}
            >
              ✕
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("seller_products.title")}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t("seller_products.subtitle")}</p>
          </div>
          <Link href="/seller/products/new">
            <Button className="h-10 shrink-0 gap-2">
              <Plus className="h-4 w-4" />
              {t("seller_products.add_product")}
            </Button>
          </Link>
        </div>

        {/* Inventory summary chips */}
        {!isLoading && products.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-muted/40 text-muted-foreground border-border">
              <Package className="h-3 w-3" />
              {t("seller_products.filter_all")}: <span className="font-black">{products.length}</span>
            </div>
            {inStockCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {t("seller_products.filter_in")}: <span className="font-black">{inStockCount}</span>
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                <TrendingDown className="h-3 w-3 shrink-0" />
                {t("seller_products.filter_low")}: <span className="font-black">{lowStockCount}</span>
              </div>
            )}
            {outOfStockCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {t("seller_products.filter_out")}: <span className="font-black">{outOfStockCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("seller_products.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 h-10"
            />
            {search && (
              <button
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="h-10 sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("seller_products.filter_all")}</SelectItem>
              <SelectItem value="in">{t("seller_products.filter_in")}</SelectItem>
              <SelectItem value="low">{t("seller_products.filter_low")}</SelectItem>
              <SelectItem value="out">{t("seller_products.filter_out")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card border rounded-2xl">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <PackageOpen className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t("seller_products.no_products")}</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">{t("seller_products.no_products_desc")}</p>
            <Link href="/seller/products/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t("seller_products.add_product")}
              </Button>
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-card border rounded-2xl">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t("seller_products.no_results")}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(""); setStockFilter("all"); }}>
              {t("common.clear_filters", "Clear filters")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow hover:border-primary/20 transition-all group"
              >
                <div className="flex items-center gap-4 px-4 sm:px-5 py-3.5">
                  {/* Image */}
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted border shrink-0 flex items-center justify-center">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm truncate">{product.name}</span>
                      {product.discountPercent && product.discountPercent > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] shrink-0 font-bold">
                          -{product.discountPercent}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize mb-1.5">{product.category}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {product.discountPercent && product.discountPercent > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-foreground">{format(product.finalPrice)}</span>
                          <span className="text-xs text-muted-foreground line-through">{format(product.price)}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-sm text-foreground">{format(product.price)}</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{t("seller_products.stock_col")}:</span>
                        {stockBadge(product.stock)}
                      </div>
                    </div>
                    {/* Quality issue badges */}
                    {qualityMap.has(product.id) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {qualityMap.get(product.id)!.includes("missing_images") && (
                          <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                            {t("seller.quality.missing_images")}
                          </span>
                        )}
                        {qualityMap.get(product.id)!.includes("short_description") && (
                          <span className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                            {t("seller.quality.short_description")}
                          </span>
                        )}
                        {qualityMap.get(product.id)!.includes("short_description_ar") && (
                          <span className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                            {t("seller.quality.short_description_ar")}
                          </span>
                        )}
                        {qualityMap.get(product.id)!.includes("missing_name_ar") && (
                          <span className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                            {t("seller.quality.missing_name_ar")}
                          </span>
                        )}
                        {qualityMap.get(product.id)!.includes("zero_price") && (
                          <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                            {t("seller.quality.zero_price")}
                          </span>
                        )}
                        {qualityMap.get(product.id)!.includes("out_of_stock") && (
                          <span className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                            {t("seller.quality.out_of_stock")}
                          </span>
                        )}
                        {qualityMap.get(product.id)!.includes("not_embedded") && (
                          <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                            {t("seller.quality.not_embedded")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    <Link href={`/seller/products/${product.id}/edit`}>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary">
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">{t("seller_products.actions_col")}</span>
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteId(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">{t("seller_products.confirm_delete")}</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("seller_products.delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("seller_products.delete_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("seller_products.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteProduct.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("seller_products.confirm_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
