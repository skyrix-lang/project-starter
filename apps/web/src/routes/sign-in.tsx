import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getGetMeQueryOptions } from "@booking/api";
import { safeReturnTo } from "@booking/core";
import { buttonVariants, Card } from "@booking/ui";
import { usePageMeta } from "../page-meta";

// The BFF sends people back here with ?error=<code> when sign-in fails
// (apps/bff/src/routes/auth.ts); each code has a message in signIn.errors.
const ERROR_CODES = [
  "AccessDenied",
  "Expired",
  "RateLimited",
  "Unavailable",
] as const;
const isErrorCode = (code: string): code is (typeof ERROR_CODES)[number] =>
  (ERROR_CODES as readonly string[]).includes(code);

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
  const { t } = useTranslation();
  usePageMeta({ title: t("signIn.title"), noindex: true });
  const { returnTo, error } = Route.useSearch();
  // A full page load, not a client-side link: the BFF redirects to the
  // identity provider.
  const loginUrl = `/auth/login?${new URLSearchParams({
    returnTo: safeReturnTo(returnTo),
  })}`;

  return (
    <section className="page-section">
      <div className="page-container">
        <div className="max-w-sm mx-auto">
          <Card className="space-y-6">
            <div className="text-center">
              <h1 className="text-h2">{t("signIn.title")}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("signIn.text")}
              </p>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
              >
                {t(
                  isErrorCode(error)
                    ? `signIn.errors.${error}`
                    : "signIn.errors.default",
                )}
              </p>
            )}
            <a href={loginUrl} className={`w-full ${buttonVariants()}`}>
              {t("signIn.continue")}
            </a>
          </Card>
        </div>
      </div>
    </section>
  );
}
