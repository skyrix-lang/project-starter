import type { QueryClient } from "@tanstack/react-query";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, buttonVariants, Toaster } from "@booking/ui";
import { ConsentBanner } from "../components/consent-banner";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { usePageMeta } from "../page-meta";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootLayout,
    errorComponent: ErrorPage,
    notFoundComponent: NotFoundPage,
  },
);

function RootLayout() {
  const { t } = useTranslation();
  return (
    <Toaster label={t("toast.region")} closeLabel={t("toast.close")}>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Outlet />
          </div>
        </main>
        <Footer />
        <ConsentBanner />
      </div>
    </Toaster>
  );
}

function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrors = useQueryErrorResetBoundary();
  const { t } = useTranslation();
  usePageMeta({ title: t("error.title"), noindex: true });
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="text-center py-20">
      <h1 className="text-2xl font-bold">{t("error.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("error.text")}</p>
      <Button
        className="mt-6"
        onClick={() => {
          queryErrors.reset();
          reset();
          void router.invalidate();
        }}
      >
        {t("error.retry")}
      </Button>
    </div>
  );
}

// The server answers 404 for an address that matches no route (routes.json);
// a route's own "not found", such as a missing record, still answers 200, so
// the page also tells search engines not to index it.
function NotFoundPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t("notFound.title"), noindex: true });
  return (
    <div className="text-center py-20">
      <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("notFound.text")}</p>
      <Link to="/" className={`mt-6 ${buttonVariants()}`}>
        {t("notFound.home")}
      </Link>
    </div>
  );
}
