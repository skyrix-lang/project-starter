import { useEffect, useRef } from "react";
import { Button } from "@booking/ui";
import {
  chooseAnalytics,
  closeConsentSettings,
  useConsent,
  type Choice,
} from "../analytics";

/** The footer's "Cookie settings" button, where focus goes when the banner closes. */
export const CONSENT_SETTINGS_ID = "cookie-settings";

/**
 * Asks whether Google Analytics may measure this visit. Shown only when the
 * server sets a measurement id, until the visitor answers, and again from
 * "Cookie settings" in the footer. Declining is as easy as accepting: same
 * buttons, side by side. It stays at the bottom of the screen without hiding
 * the page: what gets keyboard focus scrolls clear of it (WCAG 2.4.11).
 */
export function ConsentBanner() {
  const { enabled, choice, settingsOpen } = useConsent();
  const visible = enabled && (choice === null || settingsOpen);
  const region = useRef<HTMLElement>(null);

  // When "Cookie settings" opens it, it takes focus, so keyboard and screen
  // reader users land on it.
  useEffect(() => {
    if (settingsOpen) region.current?.focus();
  }, [settingsOpen]);

  // Focused elements scroll above the banner, not under it.
  useEffect(() => {
    const element = region.current;
    if (!visible || !element) return;
    const root = document.documentElement;
    const fit = () => {
      root.style.scrollPaddingBottom = `${element.offsetHeight + 16}px`;
    };
    fit();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(fit);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.scrollPaddingBottom = "";
    };
  }, [visible]);

  // Escape closes it, but only when it was opened to change an answer.
  useEffect(() => {
    if (!settingsOpen || choice === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        closeKeepingFocus(region.current, true, closeConsentSettings);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, choice]);

  if (!visible) return null;

  const choose = (value: Choice) =>
    closeKeepingFocus(region.current, settingsOpen, () =>
      chooseAnalytics(value),
    );

  return (
    <div className="pointer-events-none sticky bottom-0 z-50 px-4 pb-4 sm:px-6">
      <section
        ref={region}
        tabIndex={-1}
        aria-labelledby="consent-title"
        aria-describedby="consent-description"
        className="pointer-events-auto mx-auto max-w-2xl rounded-lg border bg-card p-5 text-card-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p id="consent-title" className="font-semibold">
          Cookies
        </p>
        <p
          id="consent-description"
          className="mt-1 text-sm text-muted-foreground"
        >
          May we measure how this site is used, with Google Analytics? It sets
          cookies and sends Google your visit. Nothing is measured unless you
          accept, and you can change your mind any time from “Cookie settings”
          at the bottom of the page.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => choose("denied")}>
            Decline
          </Button>
          <Button variant="secondary" onClick={() => choose("granted")}>
            Accept
          </Button>
        </div>
      </section>
    </div>
  );
}

/**
 * Closing removes the focused button: focus moves to "Cookie settings", where
 * the choice can be changed. A keyboard user is taken there, scrolling if
 * needed, so focus is never on something out of sight; after a click the page
 * stays where it is.
 */
function closeKeepingFocus(
  banner: HTMLElement | null,
  fromSettings: boolean,
  close: () => void,
) {
  const focused = document.activeElement;
  const hadFocus = banner?.contains(focused);
  const byKeyboard = fromSettings || !!focused?.matches(":focus-visible");
  close();
  if (hadFocus) {
    document
      .getElementById(CONSENT_SETTINGS_ID)
      ?.focus({ preventScroll: !byKeyboard });
  }
}
