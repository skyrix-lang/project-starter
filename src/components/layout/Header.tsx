"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import type { NavLink as NavLinkType } from "@/types";

const navLinks: NavLinkType[] = [
  { label: "Home", href: "/" },
  { label: "Bookings", href: "/bookings" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const linkClass = (href: string, block = false) => {
    const isActive = pathname === href;
    return `${block ? "block " : ""}px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary-50 text-primary-700"
        : "text-surface-600 hover:text-surface-900 hover:bg-surface-100"
    }`;
  };

  // Desktop and mobile navigation are switched with CSS, not JavaScript: the
  // server can't know the screen size, so both must be in the server HTML.
  return (
    <header className="bg-white border-b border-surface-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Logo"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-lg font-bold text-surface-900">
              BookingHub
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 rounded-md text-surface-500 hover:bg-surface-100 cursor-pointer"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-surface-200 px-4 py-2 bg-white">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={linkClass(link.href, true)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
