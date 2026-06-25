import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

// ─── Freshness thresholds (A4.7) ─────────────────────────────────────────────
const FRESH_S   = 15;
const WARNING_S = 60;

type Freshness = "FRESH" | "WARNING" | "STALE" | "UNKNOWN";

function calcFreshness(lastPositionAt: string | null): { status: Freshness; ageSeconds: number | null } {
  if (!lastPositionAt) return { status: "UNKNOWN", ageSeconds: null };
  const ageSeconds = Math.floor((Date.now() - new Date(lastPositionAt).getTime()) / 1000);
  if (ageSeconds < FRESH_S)   return { status: "FRESH",   ageSeconds };
  if (ageSeconds < WARNING_S) return { status: "WARNING", ageSeconds };
  return { status: "STALE", ageSeconds };
}

function FreshnessBadge({ lastPositionAt }: { lastPositionAt: string | null }) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const { status, ageSeconds } = calcFreshness(lastPositionAt);

  if (status === "FRESH") {
    return (
      <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
        {t("tracking_monitor.fresh")} {ageSeconds != null ? `${ageSeconds}s` : ""}
      </Badge>
    );
  }
  if (status === "WARNING") {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
        {t("tracking_monitor.warning")} {ageSeconds != null ? `${ageSeconds}s` : ""}
      </Badge>
    );
  }
  if (status === "STALE") {
    return (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">
        {t("tracking_monitor.stale")} {ageSeconds != null ? `${ageSeconds}s` : ""}
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">
      {t("tracking_monitor.no_position")}
    </Badge>
  );
}

interface ActiveSession {
  id:             number;
  missionId:      number;
  courierId:      number;
  orderId:        number;
  isActive:       boolean;
  startedAt:      string;
  lastPositionAt: string | null;
  positionCount:  number;
  missionStatus:  string;
  courierName:    string;
  courierPhone:   string;
  freshness:      { status: Freshness; ageSeconds: number | null };
}

interface SessionsResponse {
  total:    number;
  sessions: ActiveSession[];
}

export default function AdminTrackingMonitor() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const isRTL = i18n.dir() === "rtl";

  const [data,    setData]    = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tracking/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SessionsResponse = await res.json();
      // Recalculate freshness client-side for live ticking
      setData({
        ...json,
        sessions: json.sessions.map((s) => ({
          ...s,
          freshness: calcFreshness(s.lastPositionAt),
        })),
      });
      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
    const id = setInterval(fetchSessions, 10_000);
    return () => clearInterval(id);
  }, [fetchSessions]);

  const missionStatusColor: Record<string, string> = {
    ACCEPTED:  "text-blue-400",
    PICKED_UP: "text-amber-400",
    IN_TRANSIT: "text-purple-400",
    DELIVERED: "text-primary",
    FAILED:    "text-red-400",
    CANCELLED: "text-zinc-400",
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 py-8" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("tracking_monitor.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("tracking_monitor.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {t("tracking_monitor.last_refresh")}: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button size="sm" variant="outline" onClick={fetchSessions} disabled={loading}>
              {loading ? t("tracking_monitor.refreshing") : t("tracking_monitor.refresh")}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/courier-locations">{t("tracking_monitor.live_gps")}</Link>
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: t("tracking_monitor.total_sessions"),  value: data.total,                                    color: "text-foreground" },
              { label: t("tracking_monitor.fresh_count"),     value: data.sessions.filter((s) => s.freshness.status === "FRESH").length,   color: "text-primary" },
              { label: t("tracking_monitor.warning_count"),   value: data.sessions.filter((s) => s.freshness.status === "WARNING").length, color: "text-amber-400" },
              { label: t("tracking_monitor.stale_count"),     value: data.sessions.filter((s) => s.freshness.status === "STALE" || s.freshness.status === "UNKNOWN").length, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border bg-card">
                <CardContent className="pt-4 pb-3 text-center">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-500/30 bg-red-500/5 mb-4">
            <CardContent className="pt-4 text-sm text-red-400">{error}</CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-card animate-pulse border border-border" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && data && data.sessions.length === 0 && (
          <Card className="border-border bg-card">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="text-4xl mb-3">📡</div>
              <p className="text-muted-foreground">{t("tracking_monitor.empty")}</p>
            </CardContent>
          </Card>
        )}

        {/* Session list */}
        {data && data.sessions.length > 0 && (
          <div className="space-y-3">
            {data.sessions.map((session) => {
              const { status: freshStatus, ageSeconds } = calcFreshness(session.lastPositionAt);
              return (
                <Card key={session.id} className="border-border bg-card hover:border-primary/30 transition-colors">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      {/* Left: mission + courier info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground text-sm">
                            {t("tracking_monitor.mission")} #{session.missionId}
                          </span>
                          <Badge variant="outline" className={`text-xs border-border ${missionStatusColor[session.missionStatus] ?? "text-muted-foreground"}`}>
                            {session.missionStatus}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                            {t("tracking_monitor.order")} #{session.orderId}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                          <span>🏍️ {session.courierName}</span>
                          <span>📞 {session.courierPhone}</span>
                          <span>📍 {session.positionCount} {t("tracking_monitor.positions")}</span>
                          <span>⏱ {t("tracking_monitor.started")}: {new Date(session.startedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {/* Right: freshness */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <FreshnessBadge lastPositionAt={session.lastPositionAt} />
                        {session.lastPositionAt && (
                          <span className="text-xs text-muted-foreground">
                            {t("tracking_monitor.last_position")}: {new Date(session.lastPositionAt).toLocaleTimeString()}
                          </span>
                        )}
                        {!session.lastPositionAt && (
                          <span className="text-xs text-muted-foreground">
                            {t("tracking_monitor.awaiting_position")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Freshness bar */}
                    <div className="mt-3 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          freshStatus === "FRESH"   ? "bg-primary w-full" :
                          freshStatus === "WARNING" ? "bg-amber-500 w-2/3" :
                          freshStatus === "STALE"   ? "bg-red-500 w-1/4" : "w-0"
                        }`}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("tracking_monitor.footer")}
        </p>
      </div>
    </AdminLayout>
  );
}
