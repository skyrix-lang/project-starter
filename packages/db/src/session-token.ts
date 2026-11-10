import { createHash } from "node:crypto";

/**
 * How `user_sessions.token_hash` is derived from the cookie's token. The BFF
 * and the local sign-in scripts (`yarn dev:session`, e2e) share it.
 */
export function sessionTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
