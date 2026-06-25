// @refresh reset
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCartQueryKey, addToCart } from "@workspace/api-client-react";

/* ── Storage ─────────────────────────────────────────────────── */
export const GUEST_CART_KEY = "syano_guest_cart";

export interface GuestCartItem {
  productId: number;
  variantId: number | null;
  quantity: number;
}

function readCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? (JSON.parse(raw) as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: GuestCartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {}
}

/* ── Context ─────────────────────────────────────────────────── */
interface GuestCartContextValue {
  guestItems: GuestCartItem[];
  guestTotal: number;
  addGuestItem: (productId: number, variantId: number | null, quantity?: number) => void;
  updateGuestQty: (productId: number, variantId: number | null, quantity: number) => void;
  removeGuestItem: (productId: number, variantId: number | null) => void;
  clearGuestCart: () => void;
}

const GuestCartContext = createContext<GuestCartContextValue>({
  guestItems: [],
  guestTotal: 0,
  addGuestItem: () => {},
  updateGuestQty: () => {},
  removeGuestItem: () => {},
  clearGuestCart: () => {},
});

export const useGuestCart = () => useContext(GuestCartContext);

/* ── Provider ────────────────────────────────────────────────── */
export function GuestCartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<GuestCartItem[]>(readCart);
  const mergedRef = useRef(false);

  /* Auto-merge guest cart into server cart when user logs in */
  useEffect(() => {
    if (!isAuthenticated) {
      mergedRef.current = false;
      return;
    }
    if (mergedRef.current) return;

    const pending = readCart();
    if (pending.length === 0) return;

    mergedRef.current = true;

    Promise.all(
      pending.map((item) =>
        addToCart({
          productId: item.productId,
          ...(item.variantId != null ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
        }).catch(() => {})
      )
    ).finally(() => {
      localStorage.removeItem(GUEST_CART_KEY);
      setItems([]);
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
    });
  }, [isAuthenticated, queryClient]);

  const addGuestItem = useCallback(
    (productId: number, variantId: number | null, quantity = 1) => {
      setItems((prev) => {
        const idx = prev.findIndex(
          (i) => i.productId === productId && i.variantId === variantId
        );
        const next =
          idx >= 0
            ? prev.map((i, n) =>
                n === idx ? { ...i, quantity: i.quantity + quantity } : i
              )
            : [...prev, { productId, variantId, quantity }];
        writeCart(next);
        return next;
      });
    },
    []
  );

  const updateGuestQty = useCallback(
    (productId: number, variantId: number | null, quantity: number) => {
      setItems((prev) => {
        const next =
          quantity < 1
            ? prev.filter(
                (i) => !(i.productId === productId && i.variantId === variantId)
              )
            : prev.map((i) =>
                i.productId === productId && i.variantId === variantId
                  ? { ...i, quantity }
                  : i
              );
        writeCart(next);
        return next;
      });
    },
    []
  );

  const removeGuestItem = useCallback(
    (productId: number, variantId: number | null) => {
      setItems((prev) => {
        const next = prev.filter(
          (i) => !(i.productId === productId && i.variantId === variantId)
        );
        writeCart(next);
        return next;
      });
    },
    []
  );

  const clearGuestCart = useCallback(() => {
    localStorage.removeItem(GUEST_CART_KEY);
    setItems([]);
  }, []);

  const guestTotal = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const contextValue = useMemo<GuestCartContextValue>(
    () => ({
      guestItems: items,
      guestTotal,
      addGuestItem,
      updateGuestQty,
      removeGuestItem,
      clearGuestCart,
    }),
    [items, guestTotal, addGuestItem, updateGuestQty, removeGuestItem, clearGuestCart]
  );

  return (
    <GuestCartContext.Provider value={contextValue}>
      {children}
    </GuestCartContext.Provider>
  );
}
