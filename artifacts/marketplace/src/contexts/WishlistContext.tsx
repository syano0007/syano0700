// @refresh reset
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef,
} from "react";
import { useAuth } from "./AuthContext";

const BASE = import.meta.env.BASE_URL ?? "/";

export const GUEST_WISHLIST_KEY = "syano_guest_wishlist";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ── Guest storage helpers ───────────────────────────────────────── */
function readGuestIds(): number[] {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}
function writeGuestIds(ids: number[]): void {
  try { localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids)); } catch {}
}

/* ── Context shape ───────────────────────────────────────────────── */
interface WishlistContextValue {
  ids: number[];
  isInWishlist: (productId: number) => boolean;
  toggle: (productId: number) => Promise<boolean>;
  count: number;
  refetch: () => void;
}

const WishlistContext = createContext<WishlistContextValue>({
  ids: [],
  isInWishlist: () => false,
  toggle: async () => false,
  count: 0,
  refetch: () => {},
});

export const useWishlist = () => useContext(WishlistContext);

/* ── Provider ────────────────────────────────────────────────────── */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  // Initialise from guest localStorage immediately (no flicker for guests)
  const [ids, setIds] = useState<number[]>(() => readGuestIds());
  const mergedRef = useRef(false);

  /* Fetch authenticated IDs from server */
  const fetchIds = useCallback(() => {
    if (!isAuthenticated) return;
    fetch(`${BASE}api/wishlist/ids`, {
      credentials: "include",
      headers: authHeaders(),
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: number[]) => setIds(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isAuthenticated]);

  /* Sync ids when auth state changes */
  useEffect(() => {
    if (isAuthenticated) {
      fetchIds();
    } else {
      mergedRef.current = false;
      setIds(readGuestIds());
    }
  }, [isAuthenticated, fetchIds]);

  /* Merge guest wishlist into account on login */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (mergedRef.current) return;
    mergedRef.current = true;

    const guestIds = readGuestIds();
    if (guestIds.length === 0) return;

    Promise.all(
      guestIds.map((productId) =>
        fetch(`${BASE}api/wishlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
          body: JSON.stringify({ productId }),
        }).catch(() => {})
      )
    ).finally(() => {
      localStorage.removeItem(GUEST_WISHLIST_KEY);
      // Re-fetch to get the merged server list
      fetch(`${BASE}api/wishlist/ids`, {
        credentials: "include",
        headers: authHeaders(),
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: number[]) => setIds(Array.isArray(data) ? data : []))
        .catch(() => {});
    });
  }, [isAuthenticated]);

  const isInWishlist = useCallback(
    (productId: number) => ids.includes(productId),
    [ids]
  );

  const toggle = useCallback(
    async (productId: number): Promise<boolean> => {
      const inList = ids.includes(productId);

      if (!isAuthenticated) {
        // Guest mode — update localStorage + state instantly
        setIds((prev) => {
          const next = inList
            ? prev.filter((id) => id !== productId)
            : [...prev, productId];
          writeGuestIds(next);
          return next;
        });
        return !inList;
      }

      // Authenticated — optimistic update then API
      setIds((prev) =>
        inList ? prev.filter((id) => id !== productId) : [...prev, productId]
      );
      try {
        if (inList) {
          await fetch(`${BASE}api/wishlist/${productId}`, {
            method: "DELETE",
            credentials: "include",
            headers: authHeaders(),
          });
        } else {
          await fetch(`${BASE}api/wishlist`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            credentials: "include",
            body: JSON.stringify({ productId }),
          });
        }
        return !inList;
      } catch {
        // Revert on error
        setIds((prev) =>
          inList ? [...prev, productId] : prev.filter((id) => id !== productId)
        );
        return inList;
      }
    },
    [isAuthenticated, ids]
  );

  const value = useMemo(
    () => ({ ids, isInWishlist, toggle, count: ids.length, refetch: fetchIds }),
    [ids, isInWishlist, toggle, fetchIds]
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}
