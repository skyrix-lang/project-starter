import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

/** The signed-in user, or null. `id` is the `users.id` that owns their data. */
export async function getUser(): Promise<SessionUser | null> {
  const user = (await auth())?.user;
  if (!user?.id) return null;
  return { id: user.id, email: user.email ?? null, name: user.name ?? null };
}

/**
 * For pages and Server Actions: a signed-out visitor is sent to sign in, and
 * comes back to `returnTo` afterwards.
 */
export async function requireUser(returnTo: string) {
  const user = await getUser();
  if (!user) {
    redirect(`/sign-in?${new URLSearchParams({ callbackUrl: returnTo })}`);
  }
  return user;
}
