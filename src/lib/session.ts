import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getUser() {
  const session = await auth();
  return session?.user ?? null;
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
