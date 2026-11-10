import { existsSync } from "node:fs";

/** Loads the repository's .env into process.env; variables already set win. */
export function loadEnv(file = ".env") {
  if (existsSync(file)) process.loadEnvFile(file);
}
