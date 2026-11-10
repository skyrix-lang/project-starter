import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { getGetMeQueryOptions } from "@booking/api";
import { safeReturnTo } from "@booking/core";
import { buttonVariants, Card } from "@booking/ui";
import { usePageMeta } from "../page-meta";

// The BFF sends people back here with ?error=<code> when sign-in fails
// (apps/bff/src/routes/auth.ts).
const errorMessages: Record<string, string> = {
  AccessDenied: "Sign-in was cancelled or refused.",
  Expired: "The sign-in took too long. Please start again.",
  RateLimited: "Too many sign-in attempts. Wait a few minutes, then try again.",
  Unavailable:
    "The sign-in service isn't reachable right now. Try again later.",
};
const defaultError = "Something went wrong signing you in. Please try again.";

const searchSchema = z.object({
  returnTo: z.string().optional().catch(undefined),
  error: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/sign-in")({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    const { user } = await context.queryClient.ensureQueryData(
      getGetMeQueryOptions(),
    );
    if (user) throw redirect({ href: safeReturnTo(search.returnTo) });
  },
  component: SignInPage,
});

function SignInPage() {
  usePageMeta({ title: "Sign in", noindex: true });
  const { returnTo, error } = Route.useSearch();
  // A full page load, not a client-side link: the BFF redirects to the
  // identity provider.
  const loginUrl = `/auth/login?${new URLSearchParams({
    returnTo: safeReturnTo(returnTo),
  })}`;

  return (
    <div className="max-w-sm mx-auto py-8">
      <Card className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You'll sign in with your organization's account.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
          >
            {errorMessages[error] ?? defaultError}
          </p>
        )}
        <a href={loginUrl} className={`w-full ${buttonVariants()}`}>
          Continue to sign in
        </a>
      </Card>
    </div>
  );
}
