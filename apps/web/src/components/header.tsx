import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { site } from "@booking/core";
import { cn } from "@booking/ui";
import { LanguagePicker, ThemeToggle } from "./preferences-controls";
import { UserMenu } from "./user-menu";

const navLinks = [
  { label: "nav.home", to: "/" },
  { label: "nav.bookings", to: "/bookings" },
] as const;

const linkClass = (block = false) =>
  cn(
    block && "block",
    "px-3 py-2 rounded-md text-sm font-medium transition-colors text-secondary-foreground hover:text-foreground hover:bg-muted",
  );
// Link sets aria-current="page" on the active one; this styles it.
const activeClass = "bg-primary-soft text-primary-soft-foreground";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  // Desktop and mobile navigation are switched with CSS breakpoints, never by
  // reading the screen size in render.
  return (
    <header className="bg-card border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo.svg"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-lg font-bold">{site.name}</span>
          </Link>

          <nav
            aria-label={t("nav.main")}
            className="hidden md:flex items-center gap-1 ml-auto mr-4"
          >
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: true, includeSearch: false }}
                className={linkClass()}
                activeProps={{ className: activeClass }}
              >
                {t(link.label)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguagePicker className="hidden md:block" />
            <ThemeToggle className="hidden md:inline-flex" />
            <UserMenu />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={t(mobileMenuOpen ? "nav.closeMenu" : "nav.openMenu")}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X aria-hidden="true" className="h-6 w-6" />
              ) : (
                <Menu aria-hidden="true" className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          aria-label={t("nav.main")}
          className="md:hidden border-t px-4 py-2 bg-card"
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: true, includeSearch: false }}
              onClick={() => setMobileMenuOpen(false)}
              className={linkClass(true)}
              activeProps={{ className: activeClass }}
            >
              {t(link.label)}
            </Link>
          ))}
          {/* On a phone the header has no room for these. */}
          <div className="flex items-center gap-2 mt-2 mb-1">
            <LanguagePicker />
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
