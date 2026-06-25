import { useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { getBaseUrl } from "@workspace/api-client-react";

// ─── Config — centralized, do NOT hardcode in component ──────────────────────

export const LOCATION_REPORT_CONFIG = {
  ONLINE:     5_000,   // 5 seconds while ONLINE
  BUSY:      10_000,   // 10 seconds while BUSY
  BACKGROUND:30_000,   // 30 seconds in background (future use)
  OFFLINE:       0,    // 0 = stop reporting
} as const;

export type CourierAvailabilityStatus = "ONLINE" | "BUSY" | "OFFLINE";

interface UseLocationReportingOptions {
  token: string | null;
  availabilityStatus: CourierAvailabilityStatus;
  enabled?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocationReporting({
  token,
  availabilityStatus,
  enabled = true,
}: UseLocationReportingOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionGranted = useRef(false);

  // Request permission once on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      permissionGranted.current = status === "granted";
    })();
  }, []);

  const sendLocation = useCallback(async () => {
    if (!token || !permissionGranted.current) return;
    if (!enabled) return;

    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude, heading, speed, accuracy } = pos.coords;

      await fetch(`${getBaseUrl()}/api/courier/location`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lat: latitude,
          lng: longitude,
          heading: heading ?? null,
          speed: speed ?? null,
          accuracy: accuracy ?? null,
          source: "GPS",
        }),
      });
    } catch {
      // Silently ignore — location updates are best-effort
    }
  }, [token, enabled]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // A3.5: Only report when ONLINE or BUSY; stop when OFFLINE
    if (!enabled || !token || availabilityStatus === "OFFLINE") return;

    const intervalMs = LOCATION_REPORT_CONFIG[availabilityStatus] ?? LOCATION_REPORT_CONFIG.ONLINE;

    // Send immediately on status change, then at interval
    void sendLocation();
    intervalRef.current = setInterval(() => void sendLocation(), intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [availabilityStatus, token, enabled, sendLocation]);
}
