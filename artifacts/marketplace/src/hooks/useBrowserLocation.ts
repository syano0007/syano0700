/**
 * useBrowserLocation — W6 Browser GPS Hook
 *
 * Uses navigator.geolocation.watchPosition() to continuously track
 * the courier's position and report it to PATCH /api/courier/location.
 *
 * Rules (per spec W6):
 *  - Automatic updates
 *  - Reuse existing A3 location endpoint
 *  - ONLINE/BUSY: report at interval (controlled by component)
 *  - OFFLINE: stop location reporting (caller passes enabled=false)
 */

import { useState, useEffect, useRef, useCallback } from "react";

export type GpsStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unavailable"
  | "error";

export interface BrowserLocation {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
}

interface UseBrowserLocationOptions {
  enabled: boolean;
  token: string | null;
  reportInterval?: number;
}

interface UseBrowserLocationReturn {
  location: BrowserLocation | null;
  status: GpsStatus;
  error: string | null;
  requestPermission: () => void;
}

const REPORT_INTERVAL_MS = 8_000;

export function useBrowserLocation({
  enabled,
  token,
  reportInterval = REPORT_INTERVAL_MS,
}: UseBrowserLocationOptions): UseBrowserLocationReturn {
  const [location, setLocation] = useState<BrowserLocation | null>(null);
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const watchIdRef    = useRef<number | null>(null);
  const lastReportRef = useRef<number>(0);
  const locationRef   = useRef<BrowserLocation | null>(null);

  const reportToApi = useCallback(
    async (loc: BrowserLocation) => {
      if (!token) return;
      const now = Date.now();
      if (now - lastReportRef.current < reportInterval) return;
      lastReportRef.current = now;
      try {
        await fetch("/api/courier/location", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lat: loc.lat,
            lng: loc.lng,
            heading:  loc.heading  ?? undefined,
            speed:    loc.speed    ?? undefined,
            accuracy: loc.accuracy ?? undefined,
            source:   "browser",
          }),
        });
      } catch {
        // Best-effort — silently ignore network errors
      }
    },
    [token, reportInterval],
  );

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("GPS not supported in this browser");
      return;
    }
    setStatus("requesting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: BrowserLocation = {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          heading:  pos.coords.heading,
          speed:    pos.coords.speed,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        locationRef.current = loc;
        setLocation(loc);
        setStatus("active");
        setError(null);
        reportToApi(loc);
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setStatus("denied");
          setError("GPS permission denied");
        } else {
          setStatus("error");
          setError(err.message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout:            15_000,
        maximumAge:         5_000,
      },
    );
  }, [reportToApi]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus("idle");
  }, []);

  const requestPermission = useCallback(() => {
    if (!enabled) return;
    startWatching();
  }, [enabled, startWatching]);

  useEffect(() => {
    if (enabled) {
      startWatching();
    } else {
      stopWatching();
    }
    return () => {
      stopWatching();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic reporting while watch is active (catches interval even if position hasn't changed)
  useEffect(() => {
    if (!enabled || !token) return;
    const timer = setInterval(() => {
      if (locationRef.current) {
        reportToApi(locationRef.current);
      }
    }, reportInterval);
    return () => clearInterval(timer);
  }, [enabled, token, reportInterval, reportToApi]);

  return { location, status, error, requestPermission };
}
