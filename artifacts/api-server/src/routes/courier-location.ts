import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, couriersTable } from "@workspace/db";
import { requireAuth, requireActiveAccount, requireRole } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  updateCourierLocation,
  getCourierLocation,
  getAllLiveLocations,
  validateCoordinates,
  type LocationSource,
} from "../services/courierLocationService";

const router: IRouter = Router();

// ─── PATCH /courier/location ─────────────────────────────────────────────────
// Courier updates their own live GPS position.
// Called every 5s (ONLINE), 10s (BUSY), 30s (background) from the mobile app.

router.patch("/courier/location", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const { userId, role } = req.user!;
  if (role !== "courier") {
    res.status(403).json({ error: "Only couriers can update location" });
    return;
  }

  const { lat, lng, heading, speed, accuracy, source } = req.body;

  // Basic presence check
  if (lat == null || lng == null) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);

  const { valid, reason } = validateCoordinates(latNum, lngNum);
  if (!valid) {
    logger.warn({ userId, lat, lng, reason }, "[location] Rejected invalid coordinates");
    res.status(400).json({ error: reason });
    return;
  }

  // Validate source if provided
  const validSources: LocationSource[] = ["GPS", "NETWORK", "MANUAL"];
  const locationSource: LocationSource = validSources.includes(source) ? source : "GPS";

  // Resolve courierId from userId
  const [courier] = await db
    .select({ id: couriersTable.id, availabilityStatus: couriersTable.availabilityStatus })
    .from(couriersTable)
    .where(eq(couriersTable.userId, userId));

  if (!courier) {
    res.status(404).json({ error: "Courier profile not found" });
    return;
  }

  // A3.5: Only update location if ONLINE or BUSY; reject if OFFLINE
  if (courier.availabilityStatus === "OFFLINE") {
    logger.info({ courierId: courier.id }, "[location] Location update rejected — courier is OFFLINE");
    res.status(409).json({ error: "Location updates disabled while OFFLINE" });
    return;
  }

  try {
    const result = await updateCourierLocation(courier.id, {
      lat: latNum,
      lng: lngNum,
      heading: heading != null ? Number(heading) : null,
      speed: speed != null ? Number(speed) : null,
      accuracy: accuracy != null ? Number(accuracy) : null,
      source: locationSource,
    });

    // A4: fire-and-forget position recording for active tracking session
    void import("../services/trackingService").then(({ recordPositionForActiveMission }) =>
      recordPositionForActiveMission(courier.id, latNum, lngNum, {
        heading:  heading  != null ? Number(heading)  : null,
        speed:    speed    != null ? Number(speed)    : null,
        accuracy: accuracy != null ? Number(accuracy) : null,
      }),
    );

    res.json({
      courierId: result.courierId,
      lat: result.lat,
      lng: result.lng,
      heading: result.heading,
      speed: result.speed,
      accuracy: result.accuracy,
      source: result.source,
      updatedAt: result.updatedAt.toISOString(),
      isFresh: result.isFresh,
    });
  } catch (err: any) {
    logger.error({ err, userId }, "[location] Failed to update courier location");
    res.status(500).json({ error: "Failed to update location" });
  }
});

// ─── GET /courier/location ───────────────────────────────────────────────────
// Courier retrieves their own last-known location.

router.get("/courier/location", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = req.user!;
  if (role !== "courier") {
    res.status(403).json({ error: "Only couriers can access this" });
    return;
  }

  const [courier] = await db
    .select({ id: couriersTable.id })
    .from(couriersTable)
    .where(eq(couriersTable.userId, userId));

  if (!courier) {
    res.status(404).json({ error: "Courier profile not found" });
    return;
  }

  const location = await getCourierLocation(courier.id);
  if (!location) {
    res.json({ courierId: courier.id, hasLocation: false });
    return;
  }

  res.json({
    courierId: location.courierId,
    hasLocation: true,
    lat: location.lat,
    lng: location.lng,
    heading: location.heading,
    speed: location.speed,
    accuracy: location.accuracy,
    source: location.source,
    updatedAt: location.updatedAt.toISOString(),
    isFresh: location.isFresh,
    ageSeconds: location.ageSeconds,
  });
});

// ─── GET /admin/couriers/live-locations ──────────────────────────────────────
// Admin: view all approved couriers with their current GPS positions.
// Shows fresh/stale status for each courier.

router.get("/admin/couriers/live-locations", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  try {
    const locations = await getAllLiveLocations();
    res.json({
      total: locations.length,
      online: locations.filter((l) => l.availabilityStatus === "ONLINE").length,
      busy: locations.filter((l) => l.availabilityStatus === "BUSY").length,
      offline: locations.filter((l) => l.availabilityStatus === "OFFLINE").length,
      withFreshLocation: locations.filter((l) => l.isFresh).length,
      withStaleLocation: locations.filter((l) => !l.isFresh && l.lat != null).length,
      withNoLocation: locations.filter((l) => l.lat == null).length,
      couriers: locations.map((l) => ({
        courierId: l.courierId,
        name: l.name,
        phone: l.phone,
        vehicleType: l.vehicleType,
        availabilityStatus: l.availabilityStatus,
        lat: l.lat,
        lng: l.lng,
        heading: l.heading,
        speed: l.speed,
        accuracy: l.accuracy,
        source: l.source,
        lastLocationUpdateAt: l.lastLocationUpdateAt?.toISOString() ?? null,
        isFresh: l.isFresh,
        ageSeconds: l.ageSeconds === Infinity ? null : l.ageSeconds,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[location] Failed to fetch live locations");
    res.status(500).json({ error: "Failed to fetch live locations" });
  }
});

export default router;
