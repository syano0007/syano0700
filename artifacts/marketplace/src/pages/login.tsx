import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useSEO } from "@/hooks/useSEO";
import { PageLoader } from "@/components/PageLoader";

export default function Login() {
  useSEO({ noindex: true });
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") ?? "/";
    navigate(redirect === "/login" ? "/" : redirect);
    openLogin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <PageLoader />;
}
