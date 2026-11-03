"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { emailSchema, safeCallbackUrl } from "@/lib/auth-schema";
import { signIn } from "@/lib/auth";

export type EmailSignInState = { error?: string; email?: string };

// On success both actions redirect: to Google, or to "check your email". The
// redirect is thrown, so only Auth.js's own errors are caught here.
// `callbackUrl` comes from the browser, so it's checked again.

export async function signInWithGoogle(callbackUrl: string) {
  const redirectTo = safeCallbackUrl(callbackUrl);
  try {
    await signIn("google", { redirectTo });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    redirect(
      `/sign-in?${new URLSearchParams({ callbackUrl: redirectTo, error: error.type })}`,
    );
  }
}

export async function signInWithEmail(
  callbackUrl: string,
  _previous: EmailSignInState,
  formData: FormData,
): Promise<EmailSignInState> {
  const raw = formData.get("email");
  const typed = typeof raw === "string" ? raw : "";
  const email = emailSchema.safeParse(raw);
  if (!email.success) {
    return { error: "Enter a valid email address.", email: typed };
  }

  try {
    await signIn("nodemailer", {
      email: email.data,
      redirectTo: safeCallbackUrl(callbackUrl),
    });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    // AccessDenied comes from the AUTH_ALLOWED_EMAILS check in src/lib/auth.ts.
    return {
      error:
        error.type === "AccessDenied"
          ? "This email address isn't allowed to sign in."
          : "We couldn't send the email. Please try again.",
      email: typed,
    };
  }
  return {};
}
