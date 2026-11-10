import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

// The repository's .env. Paths are relative: run drizzle-kit from this folder
// (the root db:* scripts do).
const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
