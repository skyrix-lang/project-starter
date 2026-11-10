import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { log } from "./log";

/** True when the database answers a trivial query. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch (error) {
    log.error("Health check: database unreachable", { error });
    return false;
  }
}
