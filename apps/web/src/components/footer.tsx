import { site } from "@booking/core";
import { openConsentSettings, useConsent } from "../analytics";
import { CONSENT_SETTINGS_ID } from "./consent-banner";

// Read once when the app loads: a tab left open over New Year keeps the old year.
const year = new Date().getFullYear();

export function Footer() {
  const { enabled } = useConsent();
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
            {/* Only when there is analytics to consent to. */}
            {enabled && (
              <button
                type="button"
                id={CONSENT_SETTINGS_ID}
                onClick={openConsentSettings}
                className="text-sm text-muted-foreground hover:text-foreground cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cookie settings
              </button>
            )}
          </div>
          {/* oxlint-enable jsx-a11y/anchor-is-valid */}
        </div>
      </div>
    </footer>
  );
}
