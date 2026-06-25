// @refresh reset
import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { User, AuthResponse } from "@workspace/api-client-react";
import { clearLocationStorage } from "@/lib/location-storage";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (authResponse: AuthResponse, rememberMe?: boolean) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  isAuthenticated: boolean;
  isVerified: boolean;
  isSeller: boolean;
  isCustomer: boolean;
  isAdmin: boolean;
  isCourier: boolean;
  isSellerApplicant: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function readStoredToken(): string | null {
  try {
    return localStorage.getItem("token") ?? sessionStorage.getItem("token");
  } catch {
    return null;
  }
}

function readStoredUser(): User | null {
  try {
    const token = localStorage.getItem("token") ?? sessionStorage.getItem("token");
    const userStr = localStorage.getItem("user") ?? sessionStorage.getItem("user");
    if (!token || !userStr) return null;
    return JSON.parse(userStr) as User;
  } catch {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {}
    try {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
    } catch {}
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(readStoredToken);

  /**
   * Persist auth credentials.
   * @param rememberMe  true  → localStorage  (survives browser restart)
   *                    false → sessionStorage (cleared when tab/browser closes)
   *                    undefined → defaults to true (preserves legacy behaviour)
   */
  const login = useCallback((authResponse: AuthResponse, rememberMe: boolean = true) => {
    const storage = rememberMe ? localStorage : sessionStorage;

    if (rememberMe) {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    setUser(authResponse.user);
    setToken(authResponse.token);
    storage.setItem("token", authResponse.token);
    storage.setItem("user", JSON.stringify(authResponse.user));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    // Purge all location cache so the next user/guest sees a clean state
    clearLocationStorage();
    window.dispatchEvent(new CustomEvent("syano:location-updated", {
      detail: { zoneId: null, lat: null, lng: null },
    }));
  }, []);

  const refreshAuth = useCallback(async () => {
    const storedToken = localStorage.getItem("token") ?? sessionStorage.getItem("token");
    if (!storedToken) return;
    try {
      const response = await fetch("/api/auth/reissue", {
        method: "POST",
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const inLocal = !!localStorage.getItem("token");
        const storage = inLocal ? localStorage : sessionStorage;
        setUser(data.user);
        setToken(data.token);
        storage.setItem("token", data.token);
        storage.setItem("user", JSON.stringify(data.user));
      }
    } catch {
      // ignore
    }
  }, []);

  const isAuthenticated = !!token;
  const isVerified = user?.isVerified === true;
  const isSeller = user?.role === "seller";
  const isCustomer = user?.role === "customer";
  const isAdmin = user?.role === "admin";
  const isCourier = user?.role === "courier";
  const isSellerApplicant =
    !isSeller &&
    !!(user?.sellerStatus === "pending" || user?.sellerStatus === "under_review");

  /* Memoize the context value so consumers only re-render when actual auth
     state changes — not when a parent provider (e.g. CurrencyProvider)
     re-renders due to unrelated state updates (e.g. settings loading). */
  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      login,
      logout,
      refreshAuth,
      isAuthenticated,
      isVerified,
      isSeller,
      isCustomer,
      isAdmin,
      isCourier,
      isSellerApplicant,
    }),
    [
      user,
      token,
      login,
      logout,
      refreshAuth,
      isAuthenticated,
      isVerified,
      isSeller,
      isCustomer,
      isAdmin,
      isCourier,
      isSellerApplicant,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
