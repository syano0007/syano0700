import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useSEO } from "@/hooks/useSEO";
import { PageLoader } from "@/components/PageLoader";

export default function Register() {
  useSEO({ noindex: true });
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { openRegister } = useAuthModal();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
      return;
    }
    navigate("/");
    openRegister();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <PageLoader />;
}
