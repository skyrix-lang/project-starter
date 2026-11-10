import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { test } from "@playwright/test";
import { SHARED_USER_EMAIL, SIGNED_IN_STATE } from "./auth-state";
import { createSessionFor } from "./support";

// Signs in once, by writing a session row; the other projects reuse it. The
// real Keycloak sign-in is tested in auth.spec.ts. Tests that sign out, or end
// a session, sign in as their own user so this one stays valid.
test("sign in", async ({ baseURL }) => {
  const state = await createSessionFor(SHARED_USER_EMAIL, baseURL!);
  await mkdir(dirname(SIGNED_IN_STATE), { recursive: true });
  await writeFile(SIGNED_IN_STATE, JSON.stringify(state));
});
