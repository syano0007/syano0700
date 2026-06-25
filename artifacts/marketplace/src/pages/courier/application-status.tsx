import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Truck, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowRight } from "lucide-react";

interface CourierProfile {
  id: number;
  status: "pending" | "approved" | "suspended" | "rejected";
  phone: string;
  vehicleType: string;
  district: string | null;
}

export default function CourierApplicationStatus() {
  const { t } = useTranslation();
  const { token, isCourier, refreshAuth } = useAuth();
  const [, navigate] = useLocation();

  const [profile, setProfile]   = useState<CourierProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchProfile = async () => {
    try {
      const r = await fetch("/api/couriers/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 404) { setNotFound(true); return; }
      if (r.ok) {
        const data = await r.json();
        setProfile(data);
        if (data.status === "approved" && !isCourier) {
          setRefreshing(true);
          await refreshAuth();
          setRefreshing(false);
          navigate("/courier");
        } else if (data.status === "approved" && isCourier) {
          navigate("/courier");
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCourier) { navigate("/courier"); return; }
    fetchProfile();
  }, [token, isCourier]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (notFound) {
    return (
      <Layout>
        <div className="container max-w-lg py-16 px-4 text-center">
          <AlertTriangle className="h-14 w-14 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t("courier.no_application", "No Application Found")}</h2>
          <p className="text-muted-foreground text-sm mb-6">{t("courier.no_application_desc", "You haven't applied to become a courier yet.")}</p>
          <Button asChild>
            <Link href="/courier/apply">
              {t("courier.apply_title")} <ArrowRight className="ms-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const STATUS_CONFIG = {
    pending: {
      icon: Clock,
      iconClass: "text-amber-500",
      bgClass: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
      title: t("courier.pending_title"),
      desc: t("courier.pending_desc"),
    },
    suspended: {
      icon: AlertTriangle,
      iconClass: "text-red-500",
      bgClass: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
      title: t("courier.suspended_title"),
      desc: t("courier.suspended_desc"),
    },
    rejected: {
      icon: XCircle,
      iconClass: "text-red-500",
      bgClass: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
      title: t("courier.rejected_title", "Application Rejected"),
      desc: t("courier.rejected_desc", "Your courier application was not approved this time. You may apply again later."),
    },
    approved: {
      icon: CheckCircle2,
      iconClass: "text-emerald-500",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
      title: t("courier.approved_title", "Application Approved!"),
      desc: t("courier.approved_desc", "Congratulations! Your courier account is ready. Logging you in..."),
    },
  };

  const cfg = profile ? STATUS_CONFIG[profile.status] ?? STATUS_CONFIG.pending : STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <Layout>
      <div className="container max-w-lg py-10 md:py-16 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("courier.apply_title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("courier.apply_subtitle")}</p>
        </div>

        <div className={`rounded-2xl border p-6 ${cfg.bgClass} text-center`}>
          <div className="flex items-center justify-center mb-3">
            {refreshing ? (
              <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
            ) : (
              <Icon className={`h-12 w-12 ${cfg.iconClass}`} />
            )}
          </div>
          <h2 className="text-lg font-bold mb-2">{cfg.title}</h2>
          <p className="text-sm text-muted-foreground">{cfg.desc}</p>
        </div>

        {profile && (
          <div className="mt-4 bg-card border rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("courier.phone_label")}</span>
              <span className="font-medium" dir="ltr">{profile.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("courier.vehicle_label")}</span>
              <span className="font-medium">{t(`delivery.vehicle_${profile.vehicleType}`, profile.vehicleType)}</span>
            </div>
            {profile.district && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("courier.district_label")}</span>
                <span className="font-medium">{profile.district}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {profile?.status === "pending" && (
            <Button variant="outline" onClick={fetchProfile} className="w-full">
              {t("courier.refresh_status", "Refresh Status")}
            </Button>
          )}
          {profile?.status === "rejected" && (
            <Button asChild className="w-full">
              <Link href="/courier/apply">{t("courier.apply_again", "Apply Again")}</Link>
            </Button>
          )}
          <Button variant="ghost" asChild className="w-full">
            <Link href="/customer/dashboard">{t("nav.dashboard")}</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
