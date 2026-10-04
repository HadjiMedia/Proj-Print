import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Importing this module during Next.js page-data collection is safe. Neither the
// connection string nor a Pool is accessed until a request calls getDb().
type Database = ReturnType<typeof drizzle>;

const globalForDb = globalThis as typeof globalThis & {
  __printdropPool?: Pool;
  __printdropDb?: Database;
};

let pool: Pool | undefined;
let client: Database | undefined;

export function getDb(): Database {
  if (client) return client;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required at runtime. Configure it in your deployment environment.");
  }

  // Reuse a pool during hot reloads, and reuse the module-scoped pool on warm
  // production requests. Do not create connections during build-time imports.
  if (process.env.NODE_ENV !== "production" && globalForDb.__printdropDb) {
    client = globalForDb.__printdropDb;
    pool = globalForDb.__printdropPool;
    return client;
  }

  pool = new Pool({ connectionString: databaseUrl, max: 5 });
  client = drizzle(pool);

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__printdropPool = pool;
    globalForDb.__printdropDb = client;
  }

  return client;
}
