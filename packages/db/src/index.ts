import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export * from "./schema";

/** A connection pool for `url`. The BFF creates one when it starts. */
export function createDb(url: string): Db {
  const pool = new Pool({ connectionString: url });
  // An idle connection dropping (e.g. a database restart) is otherwise an
  // uncaught exception. The pool replaces it on the next query.
  pool.on("error", (error) => console.error("Idle connection failed:", error));
  return drizzle(pool, { schema });
}
export * from "./session-token";
