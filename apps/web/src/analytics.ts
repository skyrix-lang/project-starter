import { useSyncExternalStore } from "react";

// Google Analytics 4, off unless the server sets GA_MEASUREMENT_ID: the BFF
// then writes the id into index.html and allows Google's origins in its CSP.
// Nothing is loaded from Google, and no cookie is set, until the visitor
// accepts in the consent banner (components/consent-banner.tsx). The choice is
// kept in this browser for six months (the CNIL's recommendation), then asked
// again; "Cookie settings" in the footer changes it at any time.
//
// Google Consent Mode v2: once loaded, the library is told that everything is
// denied by default, then that analytics storage only is granted. Advertising
// storage and personalisation stay denied: the banner doesn't ask for them.
//
// Page views: GA4's enhanced measurement counts the app's client-side
// navigations (browser history changes) on its own, which it does by default.

export type Choice = "granted" | "denied";

const STORAGE_KEY = "analytics-consent";
const MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000;

declare global {
  interface Window {
    dataLayer?: unknown[];
    [disable: `ga-disable-${string}`]: boolean | undefined;
  }
}

/** The measurement id the BFF wrote into the page, or undefined when analytics is off. */
export function measurementId(): string | undefined {
  const id = document
    .querySelector<HTMLMetaElement>('meta[name="ga-measurement-id"]')
    ?.content.trim();
  return id && /^G-[A-Z0-9]+$/.test(id) ? id : undefined;
}

/** The visitor's answer, if they gave one less than six months ago. */
export function storedChoice(now = Date.now()): Choice | null {
  try {
    const saved: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (
      saved &&
      typeof saved === "object" &&
      "choice" in saved &&
      "at" in saved &&
      (saved.choice === "granted" || saved.choice === "denied") &&
      typeof saved.at === "number" &&
      now - saved.at < MAX_AGE_MS
    ) {
      return saved.choice;
    }
  } catch {
    // Unreadable or blocked storage: ask.
  }
  return null;
}

function gtag(..._args: unknown[]) {
  // Google's library reads the `arguments` object itself, not an array.
  // oxlint-disable-next-line prefer-rest-params -- required by gtag.js
  window.dataLayer?.push(arguments);
}

let loaded = false;

/** Loads Google's library once, for a visitor who has accepted. */
function load(id: string) {
  window[`ga-disable-${id}`] = false;
  if (loaded) {
    gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  gtag("set", "ads_data_redaction", true);
  gtag("consent", "update", { analytics_storage: "granted" });
  gtag("js", new Date());
  gtag("config", id);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

/** Stops measuring at once and deletes Google's cookies, on every domain they may be set on. */
function stop(id: string) {
  window[`ga-disable-${id}`] = true;
  if (loaded) gtag("consent", "update", { analytics_storage: "denied" });
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]!.trim())
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
  // GA sets its cookies on the widest domain it can (`.example.com` for
  // app.example.com), so each parent domain is tried.
  const parts = window.location.hostname.split(".");
  const domains = [
    "",
    ...parts
      .slice(0, -1)
      .map((_, index) => `; domain=.${parts.slice(index).join(".")}`),
  ];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}

// The banner's state, shared by the banner and the footer's "Cookie settings".
type State = { choice: Choice | null; settingsOpen: boolean };
let state: State = { choice: null, settingsOpen: false };
const listeners = new Set<() => void>();
function update(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

/** Called once when the app starts: measures from the first page if the visitor already accepted. */
export function startAnalytics() {
  const id = measurementId();
  if (!id) return;
  update({ choice: storedChoice() });
  if (state.choice === "granted") load(id);
}

/** Records the visitor's answer, starts or stops measuring, and closes the banner. */
export function chooseAnalytics(choice: Choice) {
  const id = measurementId();
  if (!id) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ choice, at: Date.now() }),
    );
  } catch {
    // Storage is blocked: the answer holds for this visit only.
  }
  if (choice === "granted") load(id);
  else stop(id);
  update({ choice, settingsOpen: false });
}

/** Opens the banner again: the footer's "Cookie settings" button. */
export function openConsentSettings() {
  update({ settingsOpen: true });
}

/** Closes the banner that "Cookie settings" opened, without changing the answer. */
export function closeConsentSettings() {
  update({ settingsOpen: false });
}

export function useConsent(): State & { enabled: boolean } {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
  return { ...current, enabled: measurementId() !== undefined };
}
