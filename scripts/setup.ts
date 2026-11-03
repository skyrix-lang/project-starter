import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { databaseNames, devPort, isWorktree } from "./checkout";

// yarn setup: everything a fresh checkout or worktree needs before `yarn dev`.
// Safe to run again: it never overwrites an existing .env or drops data.

function setVariable(content: string, name: string, value: string) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  return pattern.test(content)
    ? content.replace(pattern, line)
    : `${content}\n${line}\n`;
}

function createEnvFile() {
  if (existsSync(".env")) {
    console.log("• .env exists: leaving it as it is.");
    return;
  }
  let content = readFileSync(".env.example", "utf8");
  content = setVariable(
    content,
    "AUTH_SECRET",
    randomBytes(33).toString("base64"),
  );
  if (isWorktree()) {
    // Its own port, so it can run beside the main checkout, and its own
    // database, so its migrations don't change anyone else's.
    const url = `http://localhost:${devPort()}`;
    const { dev } = databaseNames();
    content = setVariable(content, "PORT", String(devPort()));
    content = setVariable(content, "AUTH_URL", url);
    content = setVariable(content, "NEXT_PUBLIC_SITE_URL", url);
    content = setVariable(
      content,
      "DATABASE_URL",
      `postgres://booking:booking@localhost:5432/${dev}`,
    );
  }
  writeFileSync(".env", content);
  console.log("• Created .env with a random AUTH_SECRET.");
}

async function createDatabase(url: URL) {
  const name = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.href });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${name}"`);
      console.log(`• Created database ${name}.`);
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  createEnvFile();
  loadEnvConfig(process.cwd());

  console.log("• Starting Postgres and Mailpit…");
  execSync("sh scripts/db-up.sh && sh scripts/mail-up.sh", {
    stdio: "inherit",
  });

  const url = new URL(process.env.DATABASE_URL!);
  await createDatabase(url);
  const db = drizzle(url.href);
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.$client.end();
  console.log(`• Migrations applied to ${url.pathname.slice(1)}.`);

  const port = process.env.PORT ?? "3000";
  console.log(`
Ready. Next:
  yarn dev                 http://localhost:${port}
  sign in at /sign-in, then read the email at http://localhost:8025
  yarn db:seed <email>     demo bookings for that user`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
