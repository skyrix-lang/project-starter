import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString });
  // An idle connection dropping (e.g. a database restart) is otherwise an
  // uncaught exception. The pool replaces it on the next query.
  pool.on("error", (error) => console.error("Idle connection failed:", error));

  return drizzle(pool, { schema });
}

// Cached on globalThis so dev hot reloads reuse one connection pool. It connects
// on first use, because `next build` imports this module without a database.
const globalForDb = globalThis as typeof globalThis & {
  bookingDb?: NodePgDatabase<typeof schema>;
};

export function getDb() {
  globalForDb.bookingDb ??= connect();
  return globalForDb.bookingDb;
}
