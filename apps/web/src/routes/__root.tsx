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
import { Button, buttonVariants } from "@booking/ui";
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
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrors = useQueryErrorResetBoundary();
  usePageMeta({ title: "Something went wrong", noindex: true });
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="text-center py-20">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">Please try again.</p>
      <Button
        className="mt-6"
        onClick={() => {
          queryErrors.reset();
          reset();
          void router.invalidate();
        }}
      >
        Try again
      </Button>
    </div>
  );
}

// The SPA can't make the server answer 404, so the page tells search engines
// not to index it instead.
function NotFoundPage() {
  usePageMeta({ title: "Page not found", noindex: true });
  return (
    <div className="text-center py-20">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className={`mt-6 ${buttonVariants()}`}>
        Back to home
      </Link>
    </div>
  );
}
