import "server-only";
import { lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export interface RateLimit {
  /** How many hits a key may have in one window. */
  limit: number;
  windowSeconds: number;
}

/**
 * Counts one hit for `key`, and returns whether it's within the limit. Windows
 * are fixed: the count starts again once `windowSeconds` have passed since the
 * window's first hit. Counters live in Postgres, so every server instance shares
 * them. The upsert is a single statement, so concurrent hits are all counted.
 */
export async function hit(
  key: string,
  { limit, windowSeconds }: RateLimit,
): Promise<boolean> {
  const db = getDb();
  const resetAt = sql`now() + make_interval(secs => ${windowSeconds})`;
  const expired = sql`${rateLimits.resetAt} <= now()`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${expired} then ${resetAt} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });

  // Keeps the table small. It's indexed, and this only runs on rate-limited
  // actions, which are rare.
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, sql`now()`));

  return row.count <= limit;
}
