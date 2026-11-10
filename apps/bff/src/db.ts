import { createDb, type Db } from "@booking/db";
import { env } from "./env";

let db: Db | undefined;

/** The shared connection pool. It connects on first use, so importing the app needs no database. */
export function getDb(): Db {
  db ??= createDb(env().DATABASE_URL);
  return db;
}
