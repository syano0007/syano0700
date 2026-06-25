// @refresh reset
import { useState, useEffect, useCallback } from "react";
import type { Product } from "@workspace/api-client-react";

const STORAGE_KEY = "syano_recently_viewed";
const MAX_ITEMS = 10;

export type RecentlyViewedProduct = Pick<
  Product,
  "id" | "name" | "price" | "discountPercent" | "imageUrl" | "imageUrls" | "category" | "storeName" | "stock" | "isBestDeal"
> & { hasVariants?: boolean };

type RecentProduct = RecentlyViewedProduct;

function readFromStorage(): RecentProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeToStorage(items: RecentProduct[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
  }
}

export function useRecentlyViewed() {
  const [recentlyViewed, setRecentlyViewed] = useState<RecentProduct[]>(() => readFromStorage());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setRecentlyViewed(readFromStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const trackView = useCallback((product: Product) => {
    if (!product?.id) return;

    const snapshot: RecentProduct = {
      id: product.id,
      name: product.name,
      price: product.price,
      discountPercent: product.discountPercent,
      imageUrl: product.imageUrl || product.imageUrls?.[0] || null,
      imageUrls: product.imageUrls,
      category: product.category,
      storeName: product.storeName,
      stock: product.stock,
      isBestDeal: product.isBestDeal,
      hasVariants: (product as any).hasVariants,
    };

    setRecentlyViewed(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      const next = [snapshot, ...filtered].slice(0, MAX_ITEMS);
      writeToStorage(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRecentlyViewed([]);
  }, []);

  return { recentlyViewed, trackView, clearHistory };
}
