import { z } from "zod";

// The BFF's settings, checked once when the server starts (src/server.ts), so a
// missing value fails the deploy instead of the first request. Read them with
// env(), never process.env.

/** From the most to the least verbose; `silent` logs nothing. */
export const logLevels = ["debug", "info", "warn", "error", "silent"] as const;
export type LogLevel = (typeof logLevels)[number];

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    HOST: z.string().default("0.0.0.0"),
    /** The address people use, such as https://bookings.example.com. */
    PUBLIC_URL: z
      .url({ protocol: /^https?$/ })
      .transform((url) => url.replace(/\/$/, "")),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Signs the short-lived sign-in cookie. */
    SESSION_SECRET: z.string().min(1),
    OIDC_ISSUER: z.url(),
    OIDC_CLIENT_ID: z.string().min(1),
    OIDC_CLIENT_SECRET: z.string().min(1),
    /** The least severe level that is logged (src/log.ts). */
    LOG_LEVEL: z.enum(logLevels).default("info"),
    /** The built SPA, served in production. Unset in development (Vite serves it). */
    STATIC_DIR: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== "production") return;
    if (env.SESSION_SECRET.length < 32 || env.SESSION_SECRET === "change-me") {
      context.addIssue({
        code: "custom",
        message: "Use a random value of at least 32 characters",
        path: ["SESSION_SECRET"],
      });
    }
    if (!env.PUBLIC_URL.startsWith("https://")) {
      const local = new URL(env.PUBLIC_URL).hostname === "localhost";
      if (!local) {
        context.addIssue({
          code: "custom",
          message: "Must be https:// in production",
          path: ["PUBLIC_URL"],
        });
      }
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

/** The validated environment. Read on use, not at import: tools import the app without one. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
