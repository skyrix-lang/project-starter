import { z } from "zod";

export const emailSchema = z.email().trim().toLowerCase().max(254);

/**
 * `allowed` is a comma-separated list of addresses and `@domain` entries, from
 * AUTH_ALLOWED_EMAILS. When it's empty, every address is allowed.
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowed: string | undefined,
): boolean {
  const entries = (allowed ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) return true;
  if (!email) return false;

  const address = email.toLowerCase();
  return entries.some((entry) =>
    entry.startsWith("@") ? address.endsWith(entry) : address === entry,
  );
}

/**
 * Where to go after signing in. Only a path on this site is accepted, so a
 * crafted link can't send people elsewhere.
 */
export function safeCallbackUrl(value: unknown, fallback = "/bookings") {
  if (typeof value !== "string") return fallback;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }
  return value;
}
