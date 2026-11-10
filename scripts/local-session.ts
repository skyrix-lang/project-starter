import { randomBytes } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sessionTokenHash, userSessions, users } from "@booking/db";

// Signs a user in without the identity provider, for `yarn dev:session` and
// the e2e tests: it writes the rows the BFF's callback would write. The user is
// found or created by email and has no identity yet; signing in through
// Keycloak later with the same verified email links to it.

export const LOCAL_SESSION_COOKIE = "session"; // over http://, see apps/bff/src/session.ts

export async function createLocalSession(db: NodePgDatabase, email: string) {
  const [user] = await db
    .insert(users)
    .values({ email })
    .onConflictDoUpdate({ target: users.email, set: { email } })
    .returning({ id: users.id });
  if (!user) throw new Error("Creating the user returned no row");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db
    .insert(userSessions)
    .values({ tokenHash: sessionTokenHash(token), userId: user.id, expiresAt });
  return { userId: user.id, token, expiresAt };
}

/** A Playwright storage state holding the session cookie for `site`. */
export function storageState(site: URL, token: string, expiresAt: Date) {
  return {
    cookies: [
      {
        name: LOCAL_SESSION_COOKIE,
        value: token,
        domain: site.hostname,
        path: "/",
        expires: Math.floor(expiresAt.getTime() / 1000),
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
}
