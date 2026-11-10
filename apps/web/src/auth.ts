import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { getGetMeQueryOptions } from "@booking/api";

/**
 * For a route's `beforeLoad`: a signed-out visitor is sent to sign in, and
 * comes back to `returnTo` afterwards. This only decides what to show: the
 * BFF checks the session on every API call.
 */
export async function requireUser(queryClient: QueryClient, returnTo: string) {
  const { user } = await queryClient.ensureQueryData(getGetMeQueryOptions());
  if (!user) {
    throw redirect({ to: "/sign-in", search: { returnTo } });
  }
  return user;
}
