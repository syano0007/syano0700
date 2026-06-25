import { eq } from "drizzle-orm";
import { db, couriersTable } from "@workspace/db";
import { logger } from "../lib/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Location is considered fresh if updated within this many seconds */
export const LOCATION_FRESHNESS_SECONDS = 60;

/** Valid location source values */
export type LocationSource = "GPS" | "NETWORK" | "MANUAL";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocationUpdate {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  source?: LocationSource;
  timestamp?: string | null;
}

export interface CourierLocation {
  courierId: number;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  source: string | null;
  updatedAt: Date;
  isFresh: boolean;
  ageSeconds: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateCoordinates(lat: number, lng: number): { valid: boolean; reason?: string } {
  if (typeof lat !== "number" || isNaN(lat)) return { valid: false, reason: "lat must be a number" };
  if (typeof lng !== "number" || isNaN(lng)) return { valid: false, reason: "lng must be a number" };
  if (lat < -90 || lat > 90)   return { valid: false, reason: `lat ${lat} out of range [-90, 90]` };
  if (lng < -180 || lng > 180) return { valid: false, reason: `lng ${lng} out of range [-180, 180]` };
  return { valid: true };
}

// ─── isLocationFresh ─────────────────────────────────────────────────────────

export function isLocationFresh(lastUpdateAt: Date | null | undefined): boolean {
  if (!lastUpdateAt) return false;
  const ageMs = Date.now() - lastUpdateAt.getTime();
  return ageMs < LOCATION_FRESHNESS_SECONDS * 1000;
}

export function getLocationAgeSeconds(lastUpdateAt: Date | null | undefined): number {
  if (!lastUpdateAt) return Infinity;
  return Math.floor((Date.now() - lastUpdateAt.getTime()) / 1000);
}

// ─── updateCourierLocation ───────────────────────────────────────────────────

export async function updateCourierLocation(
  courierId: number,
  update: LocationUpdate,
): Promise<CourierLocation> {
  const { valid, reason } = validateCoordinates(update.lat, update.lng);
  if (!valid) {
    logger.warn({ courierId, lat: update.lat, lng: update.lng, reason }, "[location] Invalid coordinates rejected");
    throw new Error(`Invalid coordinates: ${reason}`);
  }

  const now = new Date();

  const [updated] = await db
    .update(couriersTable)
    .set({
      currentLat: String(update.lat),
      currentLng: String(update.lng),
      currentHeading: update.heading != null ? String(update.heading) : null,
      currentSpeed: update.speed != null ? String(update.speed) : null,
      currentAccuracy: update.accuracy != null ? String(update.accuracy) : null,
      lastLocationUpdateAt: now,
      locationSource: update.source ?? "GPS",
      updatedAt: now,
    })
    .where(eq(couriersTable.id, courierId))
    .returning();

  if (!updated) throw new Error(`Courier ${courierId} not found`);

  logger.info(
    { courierId, lat: update.lat, lng: update.lng, source: update.source ?? "GPS" },
    "[location] Courier location updated",
  );

  return {
    courierId,
    lat: update.lat,
    lng: update.lng,
    heading: update.heading ?? null,
    speed: update.speed ?? null,
    accuracy: update.accuracy ?? null,
    source: update.source ?? "GPS",
    updatedAt: now,
    isFresh: true,
    ageSeconds: 0,
  };
}

// ─── getCourierLocation ───────────────────────────────────────────────────────

export async function getCourierLocation(courierId: number): Promise<CourierLocation | null> {
  const [courier] = await db
    .select({
      id: couriersTable.id,
      currentLat: couriersTable.currentLat,
      currentLng: couriersTable.currentLng,
      currentHeading: couriersTable.currentHeading,
      currentSpeed: couriersTable.currentSpeed,
      currentAccuracy: couriersTable.currentAccuracy,
      lastLocationUpdateAt: couriersTable.lastLocationUpdateAt,
      locationSource: couriersTable.locationSource,
    })
    .from(couriersTable)
    .where(eq(couriersTable.id, courierId));

  if (!courier || courier.currentLat == null || courier.currentLng == null) return null;

  const updatedAt = courier.lastLocationUpdateAt ?? new Date(0);
  return {
    courierId,
    lat: parseFloat(String(courier.currentLat)),
    lng: parseFloat(String(courier.currentLng)),
    heading: courier.currentHeading != null ? parseFloat(String(courier.currentHeading)) : null,
    speed: courier.currentSpeed != null ? parseFloat(String(courier.currentSpeed)) : null,
    accuracy: courier.currentAccuracy != null ? parseFloat(String(courier.currentAccuracy)) : null,
    source: courier.locationSource,
    updatedAt,
    isFresh: isLocationFresh(updatedAt),
    ageSeconds: getLocationAgeSeconds(updatedAt),
  };
}

// ─── getCourierLastKnownLocation ──────────────────────────────────────────────
// Returns the last known location even if stale (null if no location ever set)
export async function getCourierLastKnownLocation(courierId: number): Promise<CourierLocation | null> {
  return getCourierLocation(courierId);
}

// ─── getAllLiveLocations (admin) ───────────────────────────────────────────────

export interface LiveLocationRow {
  courierId: number;
  userId: number;
  name: string;
  phone: string;
  vehicleType: string;
  availabilityStatus: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  source: string | null;
  lastLocationUpdateAt: Date | null;
  isFresh: boolean;
  ageSeconds: number;
}

export async function getAllLiveLocations(): Promise<LiveLocationRow[]> {
  const { usersTable } = await import("@workspace/db");

  const rows = await db
    .select({
      id: couriersTable.id,
      userId: couriersTable.userId,
      phone: couriersTable.phone,
      vehicleType: couriersTable.vehicleType,
      availabilityStatus: couriersTable.availabilityStatus,
      currentLat: couriersTable.currentLat,
      currentLng: couriersTable.currentLng,
      currentHeading: couriersTable.currentHeading,
      currentSpeed: couriersTable.currentSpeed,
      currentAccuracy: couriersTable.currentAccuracy,
      lastLocationUpdateAt: couriersTable.lastLocationUpdateAt,
      locationSource: couriersTable.locationSource,
      name: usersTable.name,
    })
    .from(couriersTable)
    .innerJoin(usersTable, eq(usersTable.id, couriersTable.userId))
    .where(eq(couriersTable.status, "approved"));

  return rows.map((r) => {
    const lastUpdate = r.lastLocationUpdateAt ?? null;
    return {
      courierId: r.id,
      userId: r.userId,
      name: r.name,
      phone: r.phone,
      vehicleType: r.vehicleType,
      availabilityStatus: r.availabilityStatus ?? "OFFLINE",
      lat: r.currentLat != null ? parseFloat(String(r.currentLat)) : null,
      lng: r.currentLng != null ? parseFloat(String(r.currentLng)) : null,
      heading: r.currentHeading != null ? parseFloat(String(r.currentHeading)) : null,
      speed: r.currentSpeed != null ? parseFloat(String(r.currentSpeed)) : null,
      accuracy: r.currentAccuracy != null ? parseFloat(String(r.currentAccuracy)) : null,
      source: r.locationSource ?? null,
      lastLocationUpdateAt: lastUpdate,
      isFresh: isLocationFresh(lastUpdate),
      ageSeconds: getLocationAgeSeconds(lastUpdate),
    };
  });
}
