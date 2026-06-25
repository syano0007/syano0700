import "@/i18n";
import { lazy, Suspense, useEffect } from "react";
import { useSettingsSync } from "@/hooks/useSettingsSync";
// Home is imported EAGERLY — it is the primary landing page and lazy-loading it
// creates an extra async chunk waterfall that directly delays LCP. All other
// pages remain lazy since they are not in the critical first-render path.
import Home from "@/pages/home";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getGetPublicSettingsQueryKey,
  getListProductsQueryKey,
  getGetBestSellersQueryKey,
} from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { setupApi } from "@/lib/api-setup";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageTransition } from "@/components/PageTransition";
import { PageLoader } from "@/components/PageLoader";
import { ScrollToTop } from "@/components/ScrollToTop";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { GuestCartProvider } from "@/contexts/GuestCartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { NotificationToasts } from "@/components/NotificationToasts";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { NavigationProgress } from "@/components/NavigationProgress";
import { RoutePreloader } from "@/components/RoutePreloader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { AuthModal, AuthModalInitializer } from "@/components/AuthModal";
import { LocationProvider } from "@/contexts/LocationContext";

const NotFound          = lazy(() => import("@/pages/not-found"));
const AccountSuspended  = lazy(() => import("@/pages/account-suspended"));
const Login             = lazy(() => import("@/pages/login"));
const Register          = lazy(() => import("@/pages/register"));
const VerifyPage        = lazy(() => import("@/pages/verify"));
const ForgotPassword    = lazy(() => import("@/pages/forgot-password"));
const Products          = lazy(() => import("@/pages/products"));
const ProductDetail     = lazy(() => import("@/pages/products/[id]"));
const SearchPage        = lazy(() => import("@/pages/search"));
const CategoriesPage    = lazy(() => import("@/pages/Categories"));
const Cart              = lazy(() => import("@/pages/cart"));
const Checkout          = lazy(() => import("@/pages/checkout"));
const OrderHistory      = lazy(() => import("@/pages/orders"));
const OrderDetail       = lazy(() => import("@/pages/orders/[id]"));
const CustomerDashboard       = lazy(() => import("@/pages/customer/dashboard"));
const CourierApply            = lazy(() => import("@/pages/courier/apply"));
const CourierApplicationStatus = lazy(() => import("@/pages/courier/application-status"));
const SellerDashboard   = lazy(() => import("@/pages/seller/dashboard"));
const SellerProducts    = lazy(() => import("@/pages/seller/products"));
const NewProduct        = lazy(() => import("@/pages/seller/products/new"));
const EditProduct       = lazy(() => import("@/pages/seller/products/[id]/edit"));
const SellerOrders      = lazy(() => import("@/pages/seller/orders"));
const SellerOrderDetail = lazy(() => import("@/pages/seller/orders/[id]"));
const SellerAnalytics   = lazy(() => import("@/pages/seller/analytics"));
const SellerReviews     = lazy(() => import("@/pages/seller/reviews"));
const Inventory         = lazy(() => import("@/pages/seller/inventory"));
const SellerStoreSettings = lazy(() => import("@/pages/seller/store-settings"));
const AdminDashboard    = lazy(() => import("@/pages/admin/index"));
const AdminUsers        = lazy(() => import("@/pages/admin/users"));
const AdminProducts     = lazy(() => import("@/pages/admin/products"));
const AdminOrders       = lazy(() => import("@/pages/admin/orders"));
const AdminSettings     = lazy(() => import("@/pages/admin/settings"));
const AdminLogs         = lazy(() => import("@/pages/admin/logs"));
const AdminSellers      = lazy(() => import("@/pages/admin/sellers"));
const AdminAnalytics       = lazy(() => import("@/pages/admin/analytics"));
const AdminSearchAnalytics = lazy(() => import("@/pages/admin/SearchAnalytics"));
const SellerApply       = lazy(() => import("@/pages/seller/apply"));
const ApplicationStatus = lazy(() => import("@/pages/seller/application-status"));
const AdminDelivery                  = lazy(() => import("@/pages/admin/delivery"));
const AdminDeliveryMissions          = lazy(() => import("@/pages/admin/delivery-missions"));
const AdminCourierAvailability       = lazy(() => import("@/pages/admin/courier-availability"));
const AdminCourierLocations          = lazy(() => import("@/pages/admin/courier-locations"));
const AdminTrackingMonitor           = lazy(() => import("@/pages/admin/tracking-monitor"));
const AdminRoutingDiagnostics        = lazy(() => import("@/pages/admin/routing"));
const AdminDispatchCenter            = lazy(() => import("@/pages/admin/dispatch-center"));
const TrackingPage                   = lazy(() => import("@/pages/tracking/[missionId]"));
const AdminHeroBanners               = lazy(() => import("@/pages/admin/hero-banners"));
const AdminCourierApplications       = lazy(() => import("@/pages/admin/courier-applications"));
const AdminCourierApplicationDetail  = lazy(() => import("@/pages/admin/courier-application-detail"));
const AdminVerification              = lazy(() => import("@/pages/admin/verification"));
const AdminMessages                  = lazy(() => import("@/pages/admin/messages"));
const SellerTrustPage                = lazy(() => import("@/pages/seller/trust"));
const CourierDashboard               = lazy(() => import("@/pages/courier/dashboard"));
const CourierWorkspace               = lazy(() => import("@/pages/courier/workspace"));
const CourierHistory                 = lazy(() => import("@/pages/courier/history"));
const CourierEarnings                = lazy(() => import("@/pages/courier/earnings"));
const CourierProfilePage             = lazy(() => import("@/pages/courier/profile"));
const CourierPerformance             = lazy(() => import("@/pages/courier/performance"));
const CourierWallet                  = lazy(() => import("@/pages/courier/wallet"));
const AdminCourierPayouts            = lazy(() => import("@/pages/admin/courier-payouts"));
const WishlistPage                   = lazy(() => import("@/pages/wishlist"));
/* ── Footer / Info pages ─────────────────────────────────────── */
const AboutPage           = lazy(() => import("@/pages/about/index"));
const StoryPage           = lazy(() => import("@/pages/about/story"));
const TeamPage            = lazy(() => import("@/pages/about/team"));
const ContactPage         = lazy(() => import("@/pages/contact"));
const HowToSellPage       = lazy(() => import("@/pages/seller/how-to-sell"));
const SellerTermsPage     = lazy(() => import("@/pages/seller/terms"));
const SellerCenterPage    = lazy(() => import("@/pages/seller/center"));
const CommissionPage      = lazy(() => import("@/pages/seller/commission"));
const SellerFaqPage       = lazy(() => import("@/pages/seller/faq"));
const StorePage           = lazy(() => import("@/pages/store/[slug]"));
const MessagesPage        = lazy(() => import("@/pages/messages/index"));
const SellerMessages      = lazy(() => import("@/pages/seller/messages"));
const ShippingPage        = lazy(() => import("@/pages/shipping/index"));
const NationwidePage      = lazy(() => import("@/pages/shipping/nationwide"));
const PaymentMethodsPage  = lazy(() => import("@/pages/payment-methods"));
const SyanoGuaranteePage  = lazy(() => import("@/pages/syano-guarantee"));
const LoyaltyPage         = lazy(() => import("@/pages/loyalty"));
const HelpPage            = lazy(() => import("@/pages/help"));
const PrivacyPolicyPage   = lazy(() => import("@/pages/privacy-policy"));
const TermsOfUsePage      = lazy(() => import("@/pages/terms-of-use"));
const ReturnsPolicyPage   = lazy(() => import("@/pages/returns-policy"));
const CookiesPage         = lazy(() => import("@/pages/cookies"));
const StoresPage          = lazy(() => import("@/pages/stores"));
const CustomerSupport     = lazy(() => import("@/pages/customer/support"));
const AccountPage         = lazy(() => import("@/pages/customer/account"));
const AdminSupport        = lazy(() => import("@/pages/admin/support"));
const SupportWidget       = lazy(() => import("@/components/SupportWidget"));

setupApi();

// ── window.__prefetch type declaration ────────────────────────────────────────
// The inline <script> in index.html fires 3 fetches before any JS loads.
// We declare the shape here so TypeScript knows the contract.
declare global {
  interface Window {
    __prefetch?: {
      settings?: Promise<unknown>;
      products?: Promise<unknown>;
      bestSellers?: Promise<unknown>;
    };
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,    // 5 min — data is fresh for 5 min
      gcTime: 30 * 60 * 1000,      // 30 min — keep in memory
      refetchOnReconnect: true,
    },
  },
});

// ── Seed React Query cache from early prefetch ─────────────────────────────────
// Fire-and-forget: when each promise resolves we call setQueryData.
// If it resolves before the home page mounts, the component renders with data
// already in cache and skips the loading state entirely.
// If it resolves after mount, React Query already has an in-flight request and
// setQueryData will simply update it (deduplicated, no double fetch).
if (typeof window !== "undefined" && window.__prefetch) {
  const { settings, products, bestSellers } = window.__prefetch;
  settings?.then((data) => {
    if (data) queryClient.setQueryData(getGetPublicSettingsQueryKey(), data);
  }).catch(() => {});
  products?.then((data) => {
    if (data) queryClient.setQueryData(getListProductsQueryKey({}), data);
  }).catch(() => {});
  bestSellers?.then((data) => {
    if (data) queryClient.setQueryData(getGetBestSellersQueryKey(4), data);
  }).catch(() => {});
}

/* ── Page focus + screen-reader route announcement ───────────── */
function PageFocusManager() {
  const [location] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const main = document.getElementById("main-content") as HTMLElement | null;
    if (!main) return;

    const titleEl = document.querySelector("title");
    const pageTitle = titleEl?.textContent?.replace(/\s*—.*$/, "").trim() ?? "";
    const announcement = t("a11y.pageLoaded", { title: pageTitle });

    const announcer = document.createElement("div");
    announcer.setAttribute("aria-live", "assertive");
    announcer.setAttribute("aria-atomic", "true");
    Object.assign(announcer.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      overflow: "hidden",
      clip: "rect(0,0,0,0)",
      whiteSpace: "nowrap",
      border: "0",
    });
    document.body.appendChild(announcer);

    const timer = setTimeout(() => {
      main.focus({ preventScroll: true });
      announcer.textContent = announcement;
      setTimeout(() => { announcer.textContent = ""; if (document.body.contains(announcer)) document.body.removeChild(announcer); }, 1000);
    }, 100);

    return () => { clearTimeout(timer); if (document.body.contains(announcer)) document.body.removeChild(announcer); };
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/* ── Service Worker registration ─────────────────────────────── */
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In development / preview a previously-installed service worker (or its
    // caches) can pin stale code — e.g. an old sticky navbar that lingers even
    // after the source no longer contains it. Actively unregister any workers
    // and purge caches so the preview always reflects the latest source.
    if (!import.meta.env.PROD) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL || "/" })
      .catch((err) => console.warn("[SW] Registration failed:", err));
  }, []);
  return null;
}

function Router() {
  return (
    <>
      <AuthModalInitializer />
      <NavigationProgress />
      <RoutePreloader />
      <ScrollToTop />
      <PageFocusManager />
      <ServiceWorkerRegistrar />
      <Suspense fallback={<PageLoader />}>
        <PageTransition>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/account-suspended" component={AccountSuspended} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/verify" component={VerifyPage} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/shop" component={SearchPage} />
            <Route path="/search" component={SearchPage} />
            <Route path="/products" component={SearchPage} />
            <Route path="/categories" component={CategoriesPage} />
            <Route path="/products/:id" component={ProductDetail} />

            <Route path="/cart" component={Cart} />
            <Route path="/checkout">
              <ProtectedRoute allowedRoles={["customer"]}><Checkout /></ProtectedRoute>
            </Route>
            <Route path="/orders">
              <ProtectedRoute allowedRoles={["customer"]}><OrderHistory /></ProtectedRoute>
            </Route>
            <Route path="/orders/:id">
              <ProtectedRoute allowedRoles={["customer"]}><OrderDetail /></ProtectedRoute>
            </Route>
            <Route path="/customer/dashboard">
              <ProtectedRoute allowedRoles={["customer"]}><CustomerDashboard /></ProtectedRoute>
            </Route>
            <Route path="/account">
              <ProtectedRoute><AccountPage /></ProtectedRoute>
            </Route>

            <Route path="/seller/apply">
              <ProtectedRoute allowedRoles={["customer"]}><SellerApply /></ProtectedRoute>
            </Route>
            <Route path="/seller/application-status">
              <ProtectedRoute allowedRoles={["customer"]}><ApplicationStatus /></ProtectedRoute>
            </Route>

            <Route path="/seller/dashboard">
              <ProtectedRoute allowedRoles={["seller"]}><SellerDashboard /></ProtectedRoute>
            </Route>
            <Route path="/seller/products">
              <ProtectedRoute allowedRoles={["seller"]}><SellerProducts /></ProtectedRoute>
            </Route>
            <Route path="/seller/products/new">
              <ProtectedRoute allowedRoles={["seller"]}><NewProduct /></ProtectedRoute>
            </Route>
            <Route path="/seller/products/:id/edit">
              <ProtectedRoute allowedRoles={["seller"]}><EditProduct /></ProtectedRoute>
            </Route>
            <Route path="/seller/orders/:id">
              <ProtectedRoute allowedRoles={["seller"]}><SellerOrderDetail /></ProtectedRoute>
            </Route>
            <Route path="/seller/orders">
              <ProtectedRoute allowedRoles={["seller"]}><SellerOrders /></ProtectedRoute>
            </Route>
            <Route path="/seller/inventory">
              <ProtectedRoute allowedRoles={["seller"]}><Inventory /></ProtectedRoute>
            </Route>
            <Route path="/seller/messages">
              <ProtectedRoute allowedRoles={["seller"]}><SellerMessages /></ProtectedRoute>
            </Route>
            <Route path="/seller/analytics">
              <ProtectedRoute allowedRoles={["seller"]}><SellerAnalytics /></ProtectedRoute>
            </Route>
            <Route path="/seller/reviews">
              <ProtectedRoute allowedRoles={["seller"]}><SellerReviews /></ProtectedRoute>
            </Route>
            <Route path="/seller/store-settings">
              <ProtectedRoute allowedRoles={["seller"]}><SellerStoreSettings /></ProtectedRoute>
            </Route>
            <Route path="/seller/trust">
              <ProtectedRoute allowedRoles={["seller"]}><SellerTrustPage /></ProtectedRoute>
            </Route>

            <Route path="/store/:slug" component={StorePage} />
            <Route path="/messages">
              <ProtectedRoute allowedRoles={["customer"]}><MessagesPage /></ProtectedRoute>
            </Route>
            <Route path="/support">
              <ProtectedRoute allowedRoles={["customer"]}><CustomerSupport /></ProtectedRoute>
            </Route>

            <Route path="/admin">
              <ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>
            </Route>
            <Route path="/admin/users">
              <ProtectedRoute allowedRoles={["admin"]}><AdminUsers /></ProtectedRoute>
            </Route>
            <Route path="/admin/products">
              <ProtectedRoute allowedRoles={["admin"]}><AdminProducts /></ProtectedRoute>
            </Route>
            <Route path="/admin/orders">
              <ProtectedRoute allowedRoles={["admin"]}><AdminOrders /></ProtectedRoute>
            </Route>
            <Route path="/admin/logs">
              <ProtectedRoute allowedRoles={["admin"]}><AdminLogs /></ProtectedRoute>
            </Route>
            <Route path="/admin/settings">
              <ProtectedRoute allowedRoles={["admin"]}><AdminSettings /></ProtectedRoute>
            </Route>
            <Route path="/admin/sellers">
              <ProtectedRoute allowedRoles={["admin"]}><AdminSellers /></ProtectedRoute>
            </Route>
            <Route path="/admin/analytics">
              <ProtectedRoute allowedRoles={["admin"]}><AdminAnalytics /></ProtectedRoute>
            </Route>
            <Route path="/admin/search-analytics">
              <ProtectedRoute allowedRoles={["admin"]}><AdminSearchAnalytics /></ProtectedRoute>
            </Route>
            <Route path="/admin/courier-applications/:id">
              <ProtectedRoute allowedRoles={["admin"]}><AdminCourierApplicationDetail /></ProtectedRoute>
            </Route>
            <Route path="/admin/courier-applications">
              <ProtectedRoute allowedRoles={["admin"]}><AdminCourierApplications /></ProtectedRoute>
            </Route>
            <Route path="/admin/delivery">
              <ProtectedRoute allowedRoles={["admin"]}><AdminDelivery /></ProtectedRoute>
            </Route>
            <Route path="/admin/delivery-missions">
              <ProtectedRoute allowedRoles={["admin"]}><AdminDeliveryMissions /></ProtectedRoute>
            </Route>
            <Route path="/admin/courier-availability">
              <ProtectedRoute allowedRoles={["admin"]}><AdminCourierAvailability /></ProtectedRoute>
            </Route>
            <Route path="/admin/courier-locations">
              <ProtectedRoute allowedRoles={["admin"]}><AdminCourierLocations /></ProtectedRoute>
            </Route>
            <Route path="/admin/tracking-monitor">
              <ProtectedRoute allowedRoles={["admin"]}><AdminTrackingMonitor /></ProtectedRoute>
            </Route>
            <Route path="/admin/routing">
              <ProtectedRoute allowedRoles={["admin"]}><AdminRoutingDiagnostics /></ProtectedRoute>
            </Route>
            <Route path="/admin/dispatch-center">
              <ProtectedRoute allowedRoles={["admin"]}><AdminDispatchCenter /></ProtectedRoute>
            </Route>
            <Route path="/admin/verification">
              <ProtectedRoute allowedRoles={["admin"]}><AdminVerification /></ProtectedRoute>
            </Route>
            <Route path="/admin/messages">
              <ProtectedRoute allowedRoles={["admin"]}><AdminMessages /></ProtectedRoute>
            </Route>
            <Route path="/admin/hero-banners">
              <ProtectedRoute allowedRoles={["admin"]}><AdminHeroBanners /></ProtectedRoute>
            </Route>
            <Route path="/admin/support">
              <ProtectedRoute allowedRoles={["admin"]}><AdminSupport /></ProtectedRoute>
            </Route>

            {/* ── Courier application (customers only) ──────────────── */}
            <Route path="/courier/apply">
              <ProtectedRoute allowedRoles={["customer"]}><CourierApply /></ProtectedRoute>
            </Route>
            <Route path="/courier/application-status">
              <ProtectedRoute><CourierApplicationStatus /></ProtectedRoute>
            </Route>

            {/* ── Courier workspace (W1-W10, Web-First) ─────────────── */}
            <Route path="/courier">
              <ProtectedRoute allowedRoles={["courier", "admin"]}><CourierWorkspace /></ProtectedRoute>
            </Route>
            <Route path="/courier/history">
              <ProtectedRoute allowedRoles={["courier", "admin"]}><CourierHistory /></ProtectedRoute>
            </Route>
            <Route path="/courier/earnings">
              <ProtectedRoute allowedRoles={["courier", "admin"]}><CourierEarnings /></ProtectedRoute>
            </Route>
            <Route path="/courier/profile">
              <ProtectedRoute allowedRoles={["courier", "admin"]}><CourierProfilePage /></ProtectedRoute>
            </Route>
            <Route path="/courier/performance">
              <ProtectedRoute allowedRoles={["courier", "admin"]}><CourierPerformance /></ProtectedRoute>
            </Route>
            <Route path="/courier/wallet">
              <ProtectedRoute allowedRoles={["courier", "admin"]}><CourierWallet /></ProtectedRoute>
            </Route>
            <Route path="/admin/courier-payouts">
              <ProtectedRoute allowedRoles={["admin"]}><AdminCourierPayouts /></ProtectedRoute>
            </Route>
            {/* ── Legacy courier dashboard (kept for backward compat) ── */}
            <Route path="/courier/dashboard">
              <ProtectedRoute allowedRoles={["courier", "admin"]}><CourierDashboard /></ProtectedRoute>
            </Route>

            {/* ── Live delivery tracking ─────────────────────────────── */}
            <Route path="/tracking/:missionId" component={TrackingPage} />

            {/* ── Wishlist ─ open to guests (guest wishlist supported) ── */}
            <Route path="/wishlist" component={WishlistPage} />

            {/* ── Stores directory ─ two canonical paths ───────────── */}
            <Route path="/stores" component={StoresPage} />
            <Route path="/sellers/directory" component={StoresPage} />

            <Route path="/about" component={AboutPage} />
            <Route path="/about/story" component={StoryPage} />
            <Route path="/about/team" component={TeamPage} />
            <Route path="/contact" component={ContactPage} />

            <Route path="/seller/how-to-sell" component={HowToSellPage} />
            <Route path="/seller/terms" component={SellerTermsPage} />
            <Route path="/seller/center" component={SellerCenterPage} />
            <Route path="/seller/commission" component={CommissionPage} />
            <Route path="/seller/faq" component={SellerFaqPage} />

            <Route path="/shipping" component={ShippingPage} />
            <Route path="/shipping/nationwide" component={NationwidePage} />
            <Route path="/payment-methods" component={PaymentMethodsPage} />
            <Route path="/syano-guarantee" component={SyanoGuaranteePage} />
            <Route path="/loyalty" component={LoyaltyPage} />

            <Route path="/help" component={HelpPage} />
            <Route path="/privacy-policy" component={PrivacyPolicyPage} />
            <Route path="/terms-of-use" component={TermsOfUsePage} />
            <Route path="/returns-policy" component={ReturnsPolicyPage} />
            <Route path="/cookies" component={CookiesPage} />

            <Route component={NotFound} />
          </Switch>
        </PageTransition>
      </Suspense>
    </>
  );
}

function SettingsSyncEffect() {
  useSettingsSync();
  return null;
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <CurrencyProvider>
            <AuthProvider>
              <LocationProvider>
              <AuthModalProvider>
              <SettingsSyncEffect />
              <GuestCartProvider>
              <WishlistProvider>
              <NotificationProvider>
                <TooltipProvider>
                  <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                    <Router />
                    <Suspense fallback={null}>
                      <SupportWidget />
                    </Suspense>
                  </WouterRouter>
                  {/* Global notification overlays */}
                  <NotificationToasts />
                  <PushPermissionPrompt />
                  <Toaster />
                  <AuthModal />
                </TooltipProvider>
              </NotificationProvider>
              </WishlistProvider>
              </GuestCartProvider>
              </AuthModalProvider>
              </LocationProvider>
            </AuthProvider>
          </CurrencyProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
