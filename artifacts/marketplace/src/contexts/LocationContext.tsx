import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { loadSavedCoords, loadSavedZoneId } from "@/lib/location-storage";

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  zoneId: number | null;
  zoneName: string | null;
  formattedAddress: string | null;
}

interface LocationContextValue {
  location: LocationState;
  setZoneName: (name: string | null) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

function loadInitialState(): LocationState {
  const coords = loadSavedCoords();
  const zoneId = loadSavedZoneId();
  return {
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    zoneId,
    zoneName: null,
    formattedAddress: null,
  };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationState>(loadInitialState);

  const syncToApi = useCallback(
    (lat: number, lng: number, zoneId: number | null) => {
      const token = localStorage.getItem("syano_token");
      if (!token) return;
      fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deliveryLat: lat,
          deliveryLng: lng,
          deliveryZoneId: zoneId,
        }),
      }).catch(() => {});
    },
    []
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{ zoneId: number | null; lat: number; lng: number }>
      ).detail;
      setLocation((prev) => ({
        ...prev,
        latitude: detail.lat ?? null,
        longitude: detail.lng ?? null,
        zoneId: detail.zoneId ?? null,
        zoneName: null,
      }));
      if (detail.lat !== undefined && detail.lng !== undefined) {
        syncToApi(detail.lat, detail.lng, detail.zoneId);
      }
    };
    window.addEventListener("syano:location-updated", handler);
    return () => window.removeEventListener("syano:location-updated", handler);
  }, [syncToApi]);

  const setZoneName = useCallback((name: string | null) => {
    setLocation((prev) => ({ ...prev, zoneName: name }));
  }, []);

  return (
    <LocationContext.Provider value={{ location, setZoneName }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx)
    throw new Error("useLocationContext must be used within a LocationProvider");
  return ctx;
}
