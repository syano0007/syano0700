import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "syano_push_permission_asked";
const DELAY_MS = 6_000;

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const r = await fetch("/api/push-subscriptions/vapid-public-key");
    if (!r.ok) return null;
    const { publicKey } = await r.json();
    return publicKey ?? null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PushPermissionPrompt() {
  const { isAuthenticated } = useAuth();
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const isRtl = i18n.language === "ar";

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (!("serviceWorker" in navigator)) return;

    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "dismissed");
    setVisible(false);
  }, []);

  const enable = useCallback(async () => {
    setLoading(true);
    localStorage.setItem(STORAGE_KEY, "asked");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        setLoading(false);
        return;
      }

      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        setVisible(false);
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });

      const token = localStorage.getItem("token");
      await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(
              String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")!))
            ),
            auth: btoa(
              String.fromCharCode(...new Uint8Array(subscription.getKey("auth")!))
            ),
          },
          userAgent: navigator.userAgent,
        }),
      });
    } catch (e) {
      console.warn("[PushPermission] error:", e);
    } finally {
      setVisible(false);
      setLoading(false);
    }
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className={cn(
            "fixed bottom-5 z-[150] pointer-events-auto",
            "w-[min(calc(100vw-2.5rem),420px)]",
            isRtl ? "left-5" : "right-5"
          )}
          style={{ direction: isRtl ? "rtl" : "ltr" }}
        >
          <div className={cn(
            "relative rounded-2xl border bg-card shadow-2xl overflow-hidden",
            "p-4 flex items-start gap-3"
          )}>
            {/* Gradient accent */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

            {/* Icon */}
            <div className="mt-0.5 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">
                {t("push_prompt.title")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("push_prompt.desc")}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={enable}
                  disabled={loading}
                >
                  <Bell className="h-3 w-3" />
                  {loading ? t("push_prompt.enabling") : t("push_prompt.enable")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs text-muted-foreground gap-1.5"
                  onClick={dismiss}
                  disabled={loading}
                >
                  <BellOff className="h-3 w-3" />
                  {t("push_prompt.not_now")}
                </Button>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={dismiss}
              className="absolute top-3 end-3 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
