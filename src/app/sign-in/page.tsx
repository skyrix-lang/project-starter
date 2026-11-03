import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { enabledProviders } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth-schema";
import { getUser } from "@/lib/session";
import { signInWithGoogle } from "./actions";
import { EmailForm } from "./email-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

// Auth.js sends people back here with ?error=<code> when sign-in fails.
const errorMessages: Record<string, string> = {
  AccessDenied: "This account isn't allowed to sign in.",
  Verification:
    "That sign-in link has expired or was already used. Request a new one.",
};
const defaultError = "Something went wrong signing you in. Please try again.";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const returnTo = safeCallbackUrl(callbackUrl);
  if (await getUser()) redirect(returnTo);

  const providers = enabledProviders();
  const errorCode = typeof error === "string" ? error : undefined;

  return (
    <div className="max-w-sm mx-auto py-8">
      <Card className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-surface-900">Sign in</h1>
          <p className="text-sm text-surface-500 mt-1">
            No password needed: use Google or get a link by email.
          </p>
        </div>

        {errorCode && (
          <p
            role="alert"
            className="rounded-md bg-error/10 px-3 py-2 text-sm text-red-700"
          >
            {errorMessages[errorCode] ?? defaultError}
          </p>
        )}

        {providers.google && (
          <form action={signInWithGoogle.bind(null, returnTo)}>
            <SubmitButton className="w-full">Continue with Google</SubmitButton>
          </form>
        )}

        {providers.google && providers.nodemailer && (
          <div className="flex items-center gap-3 text-xs text-surface-400">
            <span className="h-px flex-1 bg-surface-200" />
            or
            <span className="h-px flex-1 bg-surface-200" />
          </div>
        )}

        {providers.nodemailer && <EmailForm callbackUrl={returnTo} />}

        {!providers.google && !providers.nodemailer && (
          <p className="text-sm text-surface-500 text-center">
            No sign-in method is configured. Set the AUTH_* variables described
            in the README.
          </p>
        )}
      </Card>
    </div>
  );
}
