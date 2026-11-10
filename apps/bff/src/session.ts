import { randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  sessionTokenHash as hashToken,
  userSessions,
  users,
} from "@booking/db";
import { getDb } from "./db";
import { env } from "./env";

// Server-side sessions: the browser holds a random token in an HttpOnly cookie,
// so JavaScript (and an XSS) can't read it, and the identity provider's tokens
// never leave the server. Deleting the row signs the session out at once.

export const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * `__Host-` makes the browser refuse the cookie unless it is Secure, host-only
 * and for path /. Plain http:// (local development and tests) can't set Secure
 * cookies everywhere, so it uses a plain name there.
 */
export function sessionCookieName() {
  return isHttps() ? "__Host-session" : "session";
}

function isHttps() {
  return env().PUBLIC_URL.startsWith("https://");
}

/** Creates a session row and returns the token to put in the cookie. */
export async function createSession(
  userId: string,
  idToken: string | undefined,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db
    .insert(userSessions)
    .values({ tokenHash: hashToken(token), userId, idToken, expiresAt });
  // Keeps the table small: sign-ins are rare enough for this to be cheap.
  await db.delete(userSessions).where(lt(userSessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export function setSessionCookie(c: Context, token: string, expires: Date) {
  setCookie(c, sessionCookieName(), token, {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "Lax",
    path: "/",
    expires,
  });
}

/** The signed-in user for this request, or null. */
export async function getSessionUser(c: Context): Promise<SessionUser | null> {
  const token = getCookie(c, sessionCookieName());
  if (!token) return null;
  const [row] = await getDb()
    .select({ id: users.id, email: users.email, name: users.name })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(
        eq(userSessions.tokenHash, hashToken(token)),
        gt(userSessions.expiresAt, new Date()),
      ),
    );
  return row ?? null;
}

/** Deletes this request's session and cookie; returns its ID token, if any. */
export async function endSession(c: Context): Promise<string | undefined> {
  const token = getCookie(c, sessionCookieName());
  deleteCookie(c, sessionCookieName(), { path: "/", secure: isHttps() });
  if (!token) return undefined;
  const [row] = await getDb()
    .delete(userSessions)
    .where(eq(userSessions.tokenHash, hashToken(token)))
    .returning({ idToken: userSessions.idToken });
  return row?.idToken ?? undefined;
}
