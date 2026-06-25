import { useState, useMemo } from "react";
import { useListProducts, useUpdateStock, useUpdateDiscount, getListProductsQueryKey, getGetSellerDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Package, Save, Search, X, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Inventory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  const [stockValues, setStockValues] = useState<Record<number, number>>({});
  const [discountValues, setDiscountValues] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useListProducts(
    { sellerId: user?.id },
    { query: { queryKey: getListProductsQueryKey({ sellerId: user?.id }), enabled: !!user?.id } }
  );

  const updateStock = useUpdateStock({
    mutation: {
      onSuccess: () => {
        toast({ title: t("inventory.stock_updated") });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSellerDashboardQueryKey() });
      }
    }
  });

  const updateDiscount = useUpdateDiscount({
    mutation: {
      onSuccess: () => {
        toast({ title: t("inventory.discount_updated") });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSellerDashboardQueryKey() });
      }
    }
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const handleSaveStock = (id: number) => {
    const val = stockValues[id];
    if (val !== undefined) updateStock.mutate({ id, data: { stock: val } });
  };

  const handleSaveDiscount = (id: number) => {
    const valStr = discountValues[id];
    if (valStr !== undefined) {
      const val = valStr === "" ? null : parseInt(valStr, 10);
      updateDiscount.mutate({ id, data: { discountPercent: val } });
    }
  };

  return (
    <Layout>
      <SellerNav />
      <div className="container py-6 md:py-10 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("inventory.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("inventory.subtitle", "Manage stock levels and pricing")}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("inventory.search_placeholder", "Search products...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 h-10"
          />
          {search && (
            <button
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card border rounded-2xl">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t("inventory.no_products")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs">{t("inventory.no_products_desc")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center bg-card border rounded-2xl">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t("seller_products.no_results")}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch("")}>
              {t("common.clear_filters", "Clear")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((product) => {
              const isLowStock = product.stock > 0 && product.stock <= 5;
              const isOutOfStock = product.stock === 0;
              const stockChanged = stockValues[product.id] !== undefined && stockValues[product.id] !== product.stock;
              const discountChanged = discountValues[product.id] !== undefined &&
                discountValues[product.id] !== (product.discountPercent?.toString() || "");

              return (
                <div key={product.id} className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                  {/* Product info row */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/20">
                    <div className="h-10 w-10 rounded-xl overflow-hidden bg-muted border shrink-0 flex items-center justify-center">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{product.name}</span>
                        {isOutOfStock && (
                          <Badge variant="destructive" className="text-[10px] shrink-0">{t("inventory.out_of_stock")}</Badge>
                        )}
                        {isLowStock && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 text-[10px] shrink-0 gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {t("inventory.low_stock")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("inventory.base_price")}: {formatCurrency(product.price)}
                        {" · "}
                        {t("inventory.final_price")}: <span className="font-semibold text-foreground">{formatCurrency(product.finalPrice)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Edit controls */}
                  <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Stock */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{t("inventory.stock_count")}</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-28 h-9 text-sm"
                          defaultValue={product.stock}
                          onChange={(e) => setStockValues(prev => ({ ...prev, [product.id]: parseInt(e.target.value, 10) || 0 }))}
                          onKeyDown={(e) => e.key === "Enter" && stockChanged && handleSaveStock(product.id)}
                        />
                        {stockChanged && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-9 gap-1.5 text-xs"
                            onClick={() => handleSaveStock(product.id)}
                            disabled={updateStock.isPending}
                          >
                            <Save className="h-3.5 w-3.5" />
                            {t("inventory.save_stock", "Save")}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Discount */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{t("inventory.discount")}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="90"
                            className="w-24 h-9 pe-6 text-sm"
                            placeholder="0"
                            defaultValue={product.discountPercent || ""}
                            onChange={(e) => setDiscountValues(prev => ({ ...prev, [product.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && discountChanged && handleSaveDiscount(product.id)}
                          />
                          <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                        </div>
                        {/* Sale price preview */}
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground">{t("inventory.sale_price_col", "Sale Price")}</span>
                          <span className="text-sm font-semibold text-primary tabular-nums">
                            {(() => {
                              const dp = discountValues[product.id] !== undefined
                                ? parseFloat(discountValues[product.id]) || 0
                                : (product.discountPercent ?? 0);
                              return formatCurrency(parseFloat((product.price * (1 - dp / 100)).toFixed(2)));
                            })()}
                          </span>
                        </div>
                        {discountChanged && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-9 gap-1.5 text-xs"
                            onClick={() => handleSaveDiscount(product.id)}
                            disabled={updateDiscount.isPending}
                          >
                            <Save className="h-3.5 w-3.5" />
                            {t("inventory.save_discount", "Save")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
