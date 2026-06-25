import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  useAdminGetSettings,
  getAdminGetSettingsQueryKey,
  getGetPublicSettingsQueryKey,
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings, RefreshCw, Percent, Megaphone, Timer, Flame } from "lucide-react";

/** Convert a UTC ISO string from the DB to the format expected by
 *  <input type="datetime-local">: "YYYY-MM-DDTHH:MM" in local time. */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export default function AdminSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [exchangeRate,   setExchangeRate]   = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [announcement,   setAnnouncement]   = useState("");
  const [flashSaleEnd,   setFlashSaleEnd]   = useState("");

  const { data: settings, isLoading } = useAdminGetSettings();

  useEffect(() => {
    const s = settings as any;
    if (s?.exchangeRate)   setExchangeRate(String(s.exchangeRate));
    if (s?.commissionRate !== undefined) setCommissionRate(String(s.commissionRate));
    if (s?.announcement   !== undefined) setAnnouncement(String(s.announcement));
    if (s?.flashSaleEnd)   setFlashSaleEnd(isoToDatetimeLocal(s.flashSaleEnd));
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("admin.settings_saved") });
      queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPublicSettingsQueryKey() });
    },
    onError: (err: Error) =>
      toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const usdPreview  = 1;
  const sypPreview  = usdPreview * parseFloat(exchangeRate || "14500");

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6" /> {t("admin.nav_settings")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("admin.settings_desc")}</p>
        </div>

        <div className="max-w-lg space-y-6">

          {/* ── Exchange Rate ── */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-1">{t("admin.exchange_rate_title")}</h2>
            <p className="text-sm text-muted-foreground mb-5">{t("admin.exchange_rate_desc")}</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rate">{t("admin.rate_label")}</Label>
                {isLoading ? (
                  <div className="h-10 bg-muted animate-pulse rounded-md" />
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">1 USD =</span>
                      <Input
                        id="rate"
                        type="number"
                        min="1"
                        step="100"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        className="ps-16"
                        placeholder="14500"
                      />
                    </div>
                    <Button
                      onClick={() => updateMutation.mutate({ exchangeRate: parseFloat(exchangeRate) })}
                      disabled={updateMutation.isPending || !exchangeRate}
                      className="shrink-0 sm:w-auto w-full"
                    >
                      {updateMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 animate-spin me-2" />{t("admin.saving")}</>
                      ) : t("admin.save_settings")}
                    </Button>
                  </div>
                )}
              </div>

              {exchangeRate && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("admin.rate_preview")}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t("admin.rate_usd")}</p>
                      <p className="font-bold text-lg">${usdPreview.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("admin.rate_syp")}</p>
                      <p className="font-bold text-lg">{sypPreview.toLocaleString("en-US", { maximumFractionDigits: 0 })} ل.س</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Seller Commission Rate ── */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">{t("admin.commission_rate_title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{t("admin.commission_rate_desc")}</p>

            <div className="space-y-2">
              <Label htmlFor="commission">{t("admin.commission_label")}</Label>
              {isLoading ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="commission"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      placeholder="5"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">%</span>
                  </div>
                  <Button
                    onClick={() => updateMutation.mutate({ commissionRate: parseFloat(commissionRate) })}
                    disabled={updateMutation.isPending || commissionRate === ""}
                    className="shrink-0 sm:w-auto w-full"
                  >
                    {updateMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 animate-spin me-2" />{t("admin.saving")}</>
                    ) : t("admin.save_settings")}
                  </Button>
                </div>
              )}
            </div>

            {commissionRate && (
              <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                <p className="text-primary font-medium">
                  {t("admin.commission_preview", {
                    earn: (parseFloat(commissionRate || "0")).toFixed(2),
                    receive: (100 - parseFloat(commissionRate || "0")).toFixed(2),
                  })}
                </p>
              </div>
            )}
          </div>

          {/* ── Flash Sale Countdown ── */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-rose-500" />
              <h2 className="font-semibold text-foreground">{t("admin.hot_deals_title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{t("admin.hot_deals_desc")}</p>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="flashSaleEnd" className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 shrink-0" /> {t("admin.flash_end_label")}
                </Label>
                {isLoading ? (
                  <div className="h-10 bg-muted animate-pulse rounded-md" />
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="flashSaleEnd"
                      type="datetime-local"
                      value={flashSaleEnd}
                      onChange={(e) => setFlashSaleEnd(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => {
                        if (!flashSaleEnd) return;
                        const iso = new Date(flashSaleEnd).toISOString();
                        updateMutation.mutate({ flashSaleEnd: iso });
                      }}
                      disabled={updateMutation.isPending || !flashSaleEnd}
                      className="shrink-0 sm:w-auto w-full"
                    >
                      {updateMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 animate-spin me-2" />{t("admin.saving")}</>
                      ) : t("admin.save_settings")}
                    </Button>
                  </div>
                )}
              </div>

              {flashSaleEnd && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-lg p-3 text-sm">
                  <p className="text-rose-700 dark:text-rose-400 font-medium">
                    {t("admin.flash_end_preview", { date: new Date(flashSaleEnd).toLocaleString() })}
                  </p>
                  <p className="text-rose-600/70 dark:text-rose-500/70 text-xs mt-0.5">
                    {t("admin.flash_end_note")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Platform Announcement ── */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-foreground">{t("admin.announcement_title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{t("admin.announcement_desc")}</p>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="announcement">{t("admin.announcement_label")}</Label>
                {isLoading ? (
                  <div className="h-20 bg-muted animate-pulse rounded-md" />
                ) : (
                  <Textarea
                    id="announcement"
                    rows={3}
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    placeholder="e.g. 🎉 Eid Sale — up to 50% off sitewide! Shop now."
                    className="resize-none"
                  />
                )}
              </div>
              <Button
                onClick={() => updateMutation.mutate({ announcement })}
                disabled={updateMutation.isPending}
                className="w-full"
              >
                {updateMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 animate-spin me-2" />{t("admin.saving")}</>
                ) : t("admin.save_announcement")}
              </Button>
              {announcement && (
                <button
                  onClick={() => { setAnnouncement(""); updateMutation.mutate({ announcement: "" }); }}
                  className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors text-center"
                >
                  {t("admin.clear_announcement")}
                </button>
              )}
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm text-primary font-medium mb-1">{t("admin.settings_note_title")}</p>
            <p className="text-xs text-muted-foreground">{t("admin.settings_note_desc")}</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
