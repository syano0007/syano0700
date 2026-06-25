import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthResponse, User } from "@workspace/api-client-react";
import { getBaseUrl } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (authResponse: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  isAuthenticated: boolean;
  isSeller: boolean;
  isCustomer: boolean;
  isCourier: boolean;
  isAdmin: boolean;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadAuth() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("user"),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as User);
        }
      } catch {
        await AsyncStorage.multiRemove(["token", "user"]);
      } finally {
        setIsReady(true);
      }
    }
    void loadAuth();
  }, []);

  const login = useCallback(async (authResponse: AuthResponse) => {
    setToken(authResponse.token);
    setUser(authResponse.user);
    await AsyncStorage.setItem("token", authResponse.token);
    await AsyncStorage.setItem("user", JSON.stringify(authResponse.user));
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(["token", "user"]);
  }, []);

  const refreshAuth = useCallback(async () => {
    const storedToken = await AsyncStorage.getItem("token");
    if (!storedToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (res.ok) {
        const data = (await res.json()) as User;
        setUser(data);
        await AsyncStorage.setItem("user", JSON.stringify(data));
      }
    } catch {
      // ignore
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      refreshAuth,
      isAuthenticated: !!token,
      isSeller: user?.role === "seller",
      isCustomer: user?.role === "customer",
      isCourier: user?.role === "courier",
      isAdmin: user?.role === "admin",
      isReady,
    }),
    [user, token, login, logout, refreshAuth, isReady]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
