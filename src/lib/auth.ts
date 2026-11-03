import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { isEmailAllowed } from "@/lib/auth-schema";

export type ProviderId = "google" | "nodemailer";

// A provider is only offered when its settings are present, so a fork can drop
// one by leaving its variables unset.
function configuredProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    // Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET itself.
    providers.push(Google);
  }
  if (process.env.AUTH_EMAIL_SERVER && process.env.AUTH_EMAIL_FROM) {
    providers.push(
      Nodemailer({
        server: process.env.AUTH_EMAIL_SERVER,
        from: process.env.AUTH_EMAIL_FROM,
      }),
    );
  }
  return providers;
}

export function enabledProviders(): Record<ProviderId, boolean> {
  return {
    google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    nodemailer: !!(
      process.env.AUTH_EMAIL_SERVER && process.env.AUTH_EMAIL_FROM
    ),
  };
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
    // false sends the user to /sign-in?error=AccessDenied.
    signIn({ user }) {
      return isEmailAllowed(user.email, process.env.AUTH_ALLOWED_EMAILS);
    },
  },
}));
