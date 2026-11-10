import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { bffDevPort, databaseNames, devPort, isWorktree } from "./checkout";
import { loadEnv } from "./env";

// yarn setup: everything a fresh checkout or worktree needs before `yarn dev`.
// Safe to run again: it never overwrites an existing .env or drops data.

function setVariable(content: string, name: string, value: string) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^#? ?${name}=.*$`, "m");
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
    "SESSION_SECRET",
    randomBytes(33).toString("base64"),
  );
  if (isWorktree()) {
    // Its own ports, so it can run beside the main checkout, and its own
    // database, so its migrations don't change anyone else's.
    const { dev } = databaseNames();
    content = setVariable(content, "WEB_PORT", String(devPort()));
    content = setVariable(content, "PORT", String(bffDevPort()));
    content = setVariable(
      content,
      "PUBLIC_URL",
      `http://localhost:${devPort()}`,
    );
    content = setVariable(
      content,
      "DATABASE_URL",
      `postgres://booking:booking@localhost:5432/${dev}`,
    );
  }
  writeFileSync(".env", content);
  console.log("• Created .env with a random SESSION_SECRET.");
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
  loadEnv();

  console.log("• Starting Postgres and Keycloak…");
  execSync("sh scripts/db-up.sh && sh scripts/keycloak-up.sh", {
    stdio: "inherit",
  });

  const url = new URL(process.env.DATABASE_URL!);
  await createDatabase(url);
  const db = drizzle(url.href);
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
  await db.$client.end();
  console.log(`• Migrations applied to ${url.pathname.slice(1)}.`);

  console.log(`
Ready. Next:
  yarn dev                 ${process.env.PUBLIC_URL}
  sign in as ada / ada     (Keycloak, http://localhost:8180)
  yarn db:seed <email>     demo bookings for that user`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
