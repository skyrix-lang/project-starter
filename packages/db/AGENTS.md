# packages/db

Drizzle schema (`src/schema.ts`) and committed SQL migrations (`drizzle/`).
Server only: imported by the BFF and scripts, never by browser packages.
Change the schema, run `yarn db:generate --name=<what>`, read the SQL, commit.
Never edit an applied migration.
