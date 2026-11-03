"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { Button, buttonStyles } from "@/components/ui/Button";

// The layout is static, so the header can't read the session on the server.
// It loads in the browser instead; until then both renders show the same
// placeholder, which keeps hydration consistent.
export function UserMenu() {
  return (
    <SessionProvider>
      <UserMenuContent />
    </SessionProvider>
  );
}

function UserMenuContent() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return <span aria-hidden="true" className="inline-block h-8 w-20" />;
  }

  if (!session?.user) {
    if (pathname.startsWith("/sign-in")) return null;
    return (
      <Link
        href={`/sign-in?${new URLSearchParams({ callbackUrl: pathname })}`}
        className={buttonStyles({ size: "sm" })}
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline max-w-48 truncate text-sm text-surface-600">
        {session.user.email ?? session.user.name}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => signOut({ redirectTo: "/" })}
      >
        Sign out
      </Button>
    </div>
  );
}
