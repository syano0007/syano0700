import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getBaseUrl } from "@workspace/api-client-react";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "syano_wishlist_ids";

interface WishlistContextValue {
  ids: number[];
  isInWishlist: (id: number) => boolean;
  toggle: (id: number) => Promise<void>;
  isToggling: (id: number) => boolean;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue>({
  ids: [],
  isInWishlist: () => false,
  toggle: async () => {},
  isToggling: () => false,
  count: 0,
});

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuth() as any;
  const [ids, setIds] = useState<number[]>([]);
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const syncedRef = useRef(false);

  function authHeaders(): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  }

  useEffect(() => {
    if (isAuthenticated) {
      if (syncedRef.current) return;
      syncedRef.current = true;
      fetch(`${getBaseUrl()}/wishlist/ids`, { headers: authHeaders(), credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: number[] | null) => {
          if (data) setIds(data);
        })
        .catch(() => {});
    } else {
      syncedRef.current = false;
      AsyncStorage.getItem(STORAGE_KEY)
        .then((raw) => {
          if (raw) {
            try { setIds(JSON.parse(raw)); } catch { setIds([]); }
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const isInWishlist = useCallback((id: number) => ids.includes(id), [ids]);
  const isToggling = useCallback((id: number) => toggling.has(id), [toggling]);

  const toggle = useCallback(async (id: number) => {
    if (toggling.has(id)) return;
    const wasIn = ids.includes(id);
    setToggling((s) => { const n = new Set(s); n.add(id); return n; });
    setIds((prev) => wasIn ? prev.filter((x) => x !== id) : [...prev, id]);

    try {
      if (isAuthenticated) {
        if (wasIn) {
          await fetch(`${getBaseUrl()}/wishlist/${id}`, { method: "DELETE", headers: authHeaders(), credentials: "include" });
        } else {
          await fetch(`${getBaseUrl()}/wishlist`, { method: "POST", headers: authHeaders(), credentials: "include", body: JSON.stringify({ productId: id }) });
        }
      } else {
        const newIds = wasIn ? ids.filter((x) => x !== id) : [...ids, id];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newIds));
      }
    } catch {
      setIds((prev) => wasIn ? [...prev, id] : prev.filter((x) => x !== id));
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [ids, isAuthenticated, toggling]);

  return (
    <WishlistContext.Provider value={{ ids, isInWishlist, toggle, isToggling, count: ids.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
