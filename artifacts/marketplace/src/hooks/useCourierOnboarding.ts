import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns a single handler that routes the user to the correct
 * courier-onboarding destination based on their current auth state.
 *
 * NOT LOGGED IN        → /login?redirect=/courier/apply
 * APPROVED COURIER     → /courier  (Web-First Workspace — W1)
 * SUSPENDED COURIER    → /courier  (workspace shows suspension screen)
 * PENDING APPLICANT    → /courier/apply  (apply page auto-redirects to status page)
 * REJECTED APPLICANT   → /courier/apply  (apply page auto-redirects to status page)
 * CUSTOMER (no app)    → /courier/apply
 */
export function useCourierOnboarding() {
  const { isAuthenticated, isCourier } = useAuth();
  const [, navigate] = useLocation();

  const handleBecomeCourier = () => {
    if (!isAuthenticated) {
      navigate("/login?redirect=/courier/apply");
      return;
    }
    if (isCourier) {
      navigate("/courier");
      return;
    }
    // For all customer states (no app, pending, rejected):
    // the /courier/apply page auto-redirects to /courier/application-status
    // when a profile already exists.
    navigate("/courier/apply");
  };

  return { handleBecomeCourier };
}
