import "server-only";
import { z } from "zod";

// Server-side settings, checked once when the server starts (see
// src/instrumentation.ts), so a missing value fails the deploy instead of the
// first request. NEXT_PUBLIC_SITE_URL is checked at build time in src/lib/site.ts.

const optional = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

/** Both variables of a pair, or neither: one alone is almost always a typo. */
function pair(env: Record<string, unknown>, a: string, b: string) {
  return !env[a] === !env[b];
}

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.url().optional(),
    AUTH_EMAIL_SERVER: optional,
    AUTH_EMAIL_FROM: optional,
    AUTH_GOOGLE_ID: optional,
    AUTH_GOOGLE_SECRET: optional,
    AUTH_ALLOWED_EMAILS: optional,
  })
  .refine((env) => pair(env, "AUTH_EMAIL_SERVER", "AUTH_EMAIL_FROM"), {
    message: "Set both AUTH_EMAIL_SERVER and AUTH_EMAIL_FROM, or neither",
    path: ["AUTH_EMAIL_SERVER"],
  })
  .refine((env) => pair(env, "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"), {
    message: "Set both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or neither",
    path: ["AUTH_GOOGLE_ID"],
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== "production") return;
    if (env.AUTH_SECRET.length < 32 || env.AUTH_SECRET === "change-me") {
      context.addIssue({
        code: "custom",
        message:
          "Use a random value of at least 32 characters: npx auth secret",
        path: ["AUTH_SECRET"],
      });
    }
    if (!env.AUTH_URL) {
      context.addIssue({
        code: "custom",
        message: "Required in production: the site's public address",
        path: ["AUTH_URL"],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parses `source`, throwing one error that lists every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** The validated environment. Read it on use, not at import: `next build` has none. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
