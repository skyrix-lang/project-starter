import { sql } from "drizzle-orm";
import { getDb } from "./db";

/** True when the database answers a trivial query. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch (error) {
    console.error("Health check: database unreachable:", error);
    return false;
  }
}
