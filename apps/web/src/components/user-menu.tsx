import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useGetMe } from "@booking/api";
import { Button, buttonVariants } from "@booking/ui";

export function UserMenu() {
  const me = useGetMe();
  const location = useLocation();
  const { t } = useTranslation();

  if (me.isPending) {
    return <span aria-hidden="true" className="inline-block h-8 w-20" />;
  }

  const user = me.data?.user;
  if (!user) {
    if (location.pathname.startsWith("/sign-in")) return null;
    return (
      <Link
        to="/sign-in"
        search={{ returnTo: location.href }}
        className={buttonVariants({ size: "sm" })}
      >
        {t("user.signIn")}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline max-w-48 truncate text-sm text-muted-foreground">
        {user.email ?? user.name}
      </span>
      {/* A form POST: the BFF ends the session, then the provider's. */}
      <form method="post" action="/auth/logout">
        <Button type="submit" variant="secondary" size="sm">
          {t("user.signOut")}
        </Button>
      </form>
    </div>
  );
}
