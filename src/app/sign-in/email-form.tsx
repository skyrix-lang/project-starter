"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { signInWithEmail, type EmailSignInState } from "./actions";

export function EmailForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction] = useActionState<EmailSignInState, FormData>(
    signInWithEmail.bind(null, callbackUrl),
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-surface-700"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "email-error" : undefined}
          className="block w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-surface-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {state.error && (
          <p id="email-error" role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
      </div>
      <SubmitButton variant="secondary" className="w-full">
        Email me a sign-in link
      </SubmitButton>
    </form>
  );
}
