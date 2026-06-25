import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Truck, Phone, Car, MapPin, ChevronRight, Loader2 } from "lucide-react";

const VEHICLE_TYPES = ["motorcycle", "scooter", "car", "bicycle"] as const;

export default function CourierApply() {
  const { t } = useTranslation();
  const { token, isCourier } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [phone, setPhone]           = useState("");
  const [vehicleType, setVehicleType] = useState<string>("motorcycle");
  const [district, setDistrict]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking]     = useState(true);

  useEffect(() => {
    if (isCourier) { navigate("/courier"); return; }
    fetch("/api/couriers/profile", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (r) => {
      if (r.ok) {
        navigate("/courier/application-status");
      }
    }).catch(() => {}).finally(() => setChecking(false));
  }, [token, isCourier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast({ title: t("courier.phone_label") + " " + t("common.required", "required"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/couriers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: phone.trim(), vehicleType, district: district.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          navigate("/courier/application-status");
          return;
        }
        throw new Error(data.error ?? t("courier.apply_error"));
      }
      toast({ title: t("courier.apply_success") });
      navigate("/courier/application-status");
    } catch (err: any) {
      toast({ title: err.message ?? t("courier.apply_error"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-xl py-10 md:py-16 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("courier.apply_title")}</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">{t("courier.apply_desc")}</p>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border-b px-6 py-4">
            <p className="text-sm font-semibold text-foreground">{t("courier.apply_subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">
                {t("courier.phone_label")} <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("courier.phone_placeholder")}
                  className="ps-9"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">{t("courier.vehicle_label")}</label>
              <div className="grid grid-cols-2 gap-2">
                {VEHICLE_TYPES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVehicleType(v)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      vehicleType === v
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Car className="h-4 w-4 shrink-0" />
                    {t(`delivery.vehicle_${v}`, v)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">{t("courier.district_label")}</label>
              <div className="relative">
                <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder={t("courier.district_placeholder", "e.g. Aleppo Center")}
                  className="ps-9"
                />
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.submitting", "Submitting...")}</>
              ) : (
                <>{t("courier.submit_apply")} <ChevronRight className="h-4 w-4 rtl:rotate-180" /></>
              )}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
