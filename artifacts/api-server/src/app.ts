import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes";
import sitemapRouter from "./routes/sitemap";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust proxy so X-Forwarded-* headers from Replit's edge are respected
app.set("trust proxy", 1);
// Disable the default `X-Powered-By: Express` header (small security + perf win)
app.disable("x-powered-by");
// Use strong ETags for precise revalidation of GET responses
app.set("etag", "strong");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          // Strip query string so JWT tokens in SSE URLs never appear in logs
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Security headers (helmet) ─────────────────────────────────────────────────
// This is an API server (responses are JSON), so:
//   • contentSecurityPolicy is disabled — CSP belongs on the web frontend
//   • crossOriginEmbedderPolicy is disabled — not needed for an API
// All other helmet defaults are applied:
//   X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff,
//   Strict-Transport-Security, Referrer-Policy: no-referrer,
//   X-DNS-Prefetch-Control: off, X-Download-Options: noopen, etc.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production, set CORS_ORIGIN to a comma-separated list of allowed origins
// (e.g. "https://myapp.replit.app,https://www.myapp.com").
// When unset (development), requests from any origin are allowed.
//
// Replit dev domains (*.replit.dev, *.janeway.replit.dev, *.replit.app) are
// ALWAYS allowed regardless of CORS_ORIGIN so that:
//   • The Expo mobile dev app (running on *.expo.janeway.replit.dev) can reach
//     the API server during development on any Replit account.
//   • The deployed marketplace (*.replit.app) works without hardcoding its URL.
//   • The Vite dev server proxy path continues to work in all environments.
// This does NOT weaken production security: Replit's own infrastructure already
// controls which code runs on *.replit.dev — these are trusted first-party origins.
const rawCorsOrigin = process.env.CORS_ORIGIN;
const configuredOrigins = rawCorsOrigin
  ? rawCorsOrigin.split(",").map((o) => o.trim()).filter(Boolean)
  : null;

function isReplitOrigin(origin: string): boolean {
  return (
    origin.endsWith(".replit.dev") ||
    origin.endsWith(".replit.app") ||
    origin.endsWith(".janeway.replit.dev") ||
    origin.endsWith(".expo.janeway.replit.dev") ||
    origin === "https://replit.com"
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isReplitOrigin(origin)) return callback(null, true);
      if (!configuredOrigins) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  }),
);

// gzip/deflate compression. Honors `Cache-Control: no-transform` and
// the standard `Accept-Encoding` negotiation. Skips tiny payloads
// automatically (threshold 1KB). Massive win on weak connections.
app.use(
  compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
);

// Body parsers — hard limit 1 MB to prevent memory exhaustion attacks.
// extended: false disables complex nested-object parsing (prototype pollution surface).
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Sitemap routes at root level (before /api — no auth, no JSON body parser needed)
app.use(sitemapRouter);

// ── Public GET cache headers ───────────────────────────────────────────────
// Note: /products and /products/best-sellers already set their own Cache-Control
// headers inside the route handlers (where they know best about data freshness).
// This middleware covers only GET /api/settings which has no route-level header.
//   max-age=60s                : browser HTTP cache for 60 s (settings rarely change)
//   stale-while-revalidate=300 : serve stale for up to 5 min while refreshing in bg
//
// The `req.path` inside app.use("/api", ...) is the path AFTER "/api".
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" && req.path === "/settings") {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  }
  next();
});

app.use("/api", router);

// Global error handler — catches ALL unhandled async/sync errors thrown from any route.
// Without this, Express swallows the error and the request hangs or gets an empty 500.
// Must be defined AFTER all routes and have exactly 4 parameters so Express recognises it
// as an error handler (the unused _next is intentional).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status: unknown }).status)
      : typeof err === "object" && err !== null && "statusCode" in err
        ? Number((err as { statusCode: unknown }).statusCode)
        : 500;

  const safeStatus = Number.isFinite(status) && status >= 100 && status < 600 ? status : 500;
  const message    = err instanceof Error ? err.message : "Internal server error";

  logger.error({ err }, "Unhandled route error");

  if (res.headersSent) return;
  res.status(safeStatus).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : message,
  });
});

export default app;
