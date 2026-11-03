import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { headers } from "next/headers";
import { isEmailAllowed } from "@/lib/auth-schema";
import { clientIp } from "@/lib/client-ip";
import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { hit, type RateLimit } from "@/lib/rate-limit";

export type ProviderId = "google" | "nodemailer";

// Sign-in emails cost money and reputation, so they're limited per address (to
// stop someone flooding one inbox) and per client address (to stop one client
// sending to many inboxes).
const EMAILS_PER_ADDRESS: RateLimit = { limit: 3, windowSeconds: 15 * 60 };
const EMAILS_PER_CLIENT: RateLimit = { limit: 10, windowSeconds: 15 * 60 };

/** Where a refused request goes: src/app/sign-in/page.tsx shows the message. */
export const RATE_LIMITED_URL = "/sign-in?error=RateLimited";

// A provider is only offered when its settings are present, so a fork can drop
// one by leaving its variables unset. src/lib/env.ts checks they come in pairs.
export function enabledProviders(): Record<ProviderId, boolean> {
  const { AUTH_GOOGLE_ID, AUTH_EMAIL_SERVER } = env();
  return { google: !!AUTH_GOOGLE_ID, nodemailer: !!AUTH_EMAIL_SERVER };
}

function configuredProviders(): Provider[] {
  const { AUTH_EMAIL_SERVER, AUTH_EMAIL_FROM } = env();
  const enabled = enabledProviders();
  const providers: Provider[] = [];
  // Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET itself.
  if (enabled.google) providers.push(Google);
  if (enabled.nodemailer) {
    providers.push(
      Nodemailer({ server: AUTH_EMAIL_SERVER, from: AUTH_EMAIL_FROM }),
    );
  }
  return providers;
}

/** Counts a sign-in email against both limits; false when either is reached. */
async function mayEmail(address: string): Promise<boolean> {
  const ip = clientIp(await headers());
  const checks = [hit(`sign-in-email:address:${address}`, EMAILS_PER_ADDRESS)];
  if (ip) checks.push(hit(`sign-in-email:client:${ip}`, EMAILS_PER_CLIENT));
  return (await Promise.all(checks)).every(Boolean);
}

// The config is a function so the database connection, and the environment, are
// only read on the first request: `next build` imports this without either.
export const { auth, handlers, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: configuredProviders(),
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
    error: "/sign-in",
  },
  callbacks: {
    // Runs when a magic link is requested, and again on every sign-in. Returning
    // false sends the user to /sign-in?error=AccessDenied, and a path sends them
    // there instead of sending the email.
    async signIn({ user, email }) {
      if (!isEmailAllowed(user.email, env().AUTH_ALLOWED_EMAILS)) return false;
      if (email?.verificationRequest && user.email) {
        if (!(await mayEmail(user.email))) return RATE_LIMITED_URL;
      }
      return true;
    },
    // Also what /api/auth/session sends to the browser, so it lists only what
    // the UI may see. The default adds no user id, which the data layer needs;
    // returning the whole session would also send its token to JavaScript.
    session({ session, user }) {
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
        expires: session.expires,
      };
    },
  },
}));
