import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import {
  useAdminListProducts,
  useAdminUpdateProduct,
  useAdminDeleteProduct,
  getAdminListProductsQueryKey,
  getAdminGetStatsQueryKey,
  type AdminProduct,
} from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Search, Package, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

interface EditForm {
  name: string;
  price: string;
  stock: string;
  discountPercent: string;
  category: string;
}

export default function AdminProducts() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<AdminProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", price: "", stock: "", discountPercent: "", category: "" });

  const { data, isLoading } = useAdminListProducts({ page, limit: PAGE_SIZE });

  const products = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const updateMutation = useAdminUpdateProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: t("admin.product_updated") });
        queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() });
        setEditTarget(null);
      },
      onError: (err: Error) =>
        toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
    },
  });

  const featuredMutation = useAdminUpdateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() });
      },
      onError: (err: Error) =>
        toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useAdminDeleteProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: t("admin.product_deleted") });
        queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
        setDeleteTarget(null);
      },
      onError: (err: Error) =>
        toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
    },
  });

  const openEdit = (p: AdminProduct) => {
    setEditTarget(p);
    setEditForm({
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      discountPercent: p.discountPercent != null ? String(p.discountPercent) : "",
      category: p.category,
    });
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      data: {
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock, 10),
        discountPercent: editForm.discountPercent ? parseFloat(editForm.discountPercent) : null,
        category: editForm.category,
      },
    });
  };

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sellerName.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-6 w-6" /> {t("admin.nav_products")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("admin.products_desc")}</p>
          </div>
          <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            {total} {t("admin.total_count")}
          </div>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("admin.search_products")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_product")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_seller")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_category")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_price")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_stock")}</th>
                  <th className="text-end px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded-lg object-cover shrink-0 bg-muted" loading="lazy" decoding="async" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium text-foreground line-clamp-1">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.sellerName}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="font-normal">{p.category}</Badge></td>
                    <td className="px-4 py-3 font-semibold">
                      {format(p.price)}
                      {p.discountPercent != null && p.discountPercent > 0 && (
                        <span className="ms-1 text-xs text-primary font-bold">-{p.discountPercent}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={p.stock <= 0 ? "text-destructive font-semibold" : p.stock <= 5 ? "text-orange-500 font-semibold" : "text-foreground"}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-8 w-8",
                            (p as any).featured
                              ? "text-amber-500 hover:text-amber-400"
                              : "text-muted-foreground hover:text-amber-500"
                          )}
                          title={(p as any).featured ? t("admin.remove_featured") : t("admin.mark_as_featured")}
                          onClick={() =>
                            featuredMutation.mutate({
                              id: p.id,
                              data: { featured: !(p as any).featured } as any,
                            })
                          }
                        >
                          <Star className={cn("h-3.5 w-3.5", (p as any).featured && "fill-current")} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && !filtered.length && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{t("admin.no_results")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <span className="text-sm text-muted-foreground">{t("admin.page_of", { page, totalPages })}</span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-11 w-11" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <Button size="icon" variant="ghost" className="h-11 w-11" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="w-[90vw] max-w-md max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t("admin.edit_product")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("seller_products.product_name")}</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("seller_products.price_label")}</Label>
                <Input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("seller_products.stock_col")}</Label>
                <Input type="number" value={editForm.stock} onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("inventory.discount")}</Label>
                <Input type="number" min="0" max="100" placeholder="0" value={editForm.discountPercent} onChange={(e) => setEditForm((f) => ({ ...f, discountPercent: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("seller_products.category")}</Label>
                <Input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>{t("seller_products.cancel_btn")}</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("seller_products.saving") : t("seller_products.save_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("seller_products.delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("seller_products.delete_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("seller_products.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}>
              {t("seller_products.confirm_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
