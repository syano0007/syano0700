import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString:        process.env.DATABASE_URL,
  max:                     20,    // max 20 simultaneous connections
  min:                     2,     // keep 2 warm connections alive
  idleTimeoutMillis:       30_000, // close idle connections after 30 s
  connectionTimeoutMillis: 5_000,  // fail fast — no connection available in 5 s
  statement_timeout:       10_000, // kill queries running over 10 s
});
export const db = drizzle(pool, { schema });

export * from "./schema";
