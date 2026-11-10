import { and, eq, isNull } from "drizzle-orm";
import { users } from "@booking/db";
import { getDb } from "./db";

export interface Identity {
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

/**
 * The user for this identity, created on first sign-in. A user created ahead
 * of it with the same verified email but no identity yet (by `yarn
 * dev:session`, or set up in advance by email) is linked rather than
 * duplicated, so they keep their data.
 */
export async function upsertUser(identity: Identity): Promise<string> {
  const db = getDb();
  const email = identity.email?.trim().toLowerCase() || null;
  const byIdentity = and(
    eq(users.oidcIssuer, identity.issuer),
    eq(users.oidcSubject, identity.subject),
  );

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(byIdentity);
  if (existing) {
    await db.update(users).set({ name: identity.name }).where(byIdentity);
    return existing.id;
  }

  if (email && identity.emailVerified) {
    const [linked] = await db
      .update(users)
      .set({
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
        name: identity.name,
      })
      .where(and(eq(users.email, email), isNull(users.oidcIssuer)))
      .returning({ id: users.id });
    if (linked) return linked.id;
  }

  // Only a verified email is stored, and not one another user already has:
  // emails are unique, and an unverified one could be someone else's.
  const verified = identity.emailVerified ? email : null;
  const [taken] = verified
    ? await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, verified))
    : [];
  const [created] = await db
    .insert(users)
    .values({
      oidcIssuer: identity.issuer,
      oidcSubject: identity.subject,
      email: taken ? null : verified,
      name: identity.name,
    })
    .returning({ id: users.id });
  if (!created) throw new Error("Creating the user returned no row");
  return created.id;
}
