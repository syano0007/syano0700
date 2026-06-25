import React, { createContext, useContext, useState, useCallback } from "react";

export type AuthView = "login" | "register" | "forgot" | null;

interface AuthModalContextType {
  view: AuthView;
  openLogin: () => void;
  openRegister: () => void;
  openForgotPassword: () => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<AuthView>(null);
  const openLogin         = useCallback(() => setView("login"),    []);
  const openRegister      = useCallback(() => setView("register"), []);
  const openForgotPassword= useCallback(() => setView("forgot"),   []);
  const close             = useCallback(() => setView(null),        []);
  return (
    <AuthModalContext.Provider value={{ view, openLogin, openRegister, openForgotPassword, close }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
