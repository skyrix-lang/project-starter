import { site } from "@booking/core";

// Read once when the app loads: a tab left open over New Year keeps the old year.
const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-card border-t mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {year} {site.name}. All rights reserved.
          </p>
          {/* Placeholders: point these at real pages before launch. */}
          {/* oxlint-disable jsx-a11y/anchor-is-valid */}
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Terms
            </a>
          </div>
          {/* oxlint-enable jsx-a11y/anchor-is-valid */}
        </div>
      </div>
    </footer>
  );
}
