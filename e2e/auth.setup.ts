import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { SIGNED_IN_STATE } from "./auth-state";
import { signInByEmail, test } from "./support";

// Signs in once; the other projects reuse the session. Tests that sign out, or
// end a session, sign in as their own user so this one stays valid.
test("sign in", async ({ page }) => {
  await signInByEmail(page);
  await mkdir(dirname(SIGNED_IN_STATE), { recursive: true });
  await page.context().storageState({ path: SIGNED_IN_STATE });
});
