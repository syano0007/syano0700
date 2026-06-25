import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns a single handler that routes the user to the correct
 * seller-onboarding destination based on their current auth state.
 *
 * NOT LOGGED IN       → /login?redirect=/seller/apply
 * APPROVED SELLER     → /seller/dashboard
 * PENDING APPLICANT   → /seller/application-status
 * CUSTOMER (no app)   → /seller/apply
 */
export function useSellerOnboarding() {
  const { isAuthenticated, isSeller, isSellerApplicant } = useAuth();
  const [, navigate] = useLocation();

  const handleOpenYourStore = () => {
    if (!isAuthenticated) {
      navigate("/login?redirect=/seller/apply");
      return;
    }
    if (isSeller) {
      navigate("/seller/dashboard");
      return;
    }
    if (isSellerApplicant) {
      navigate("/seller/application-status");
      return;
    }
    navigate("/seller/apply");
  };

  return { handleOpenYourStore };
}
