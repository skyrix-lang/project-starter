import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { LANGUAGES, type Language } from "@booking/core";
import { messages as bookings } from "@booking/feature-bookings";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import { usePreferences } from "./preferences";

// Every text on screen comes from a messages file, one per language and
// namespace: the app's in src/locales (`app`, the default namespace), each
// feature's in its package (`bookings`). Components call
// `useTranslation(namespace)` and `t("key")`; keys are type-checked against
// the English files. A missing translation falls back to the default
// language. To translate a file, https://translate.i18next.com takes the
// English JSON and returns another language's; i18n.test.ts checks every
// language has the same keys.

const app = { en, fr } satisfies Record<Language, unknown>;

export const resources = Object.fromEntries(
  LANGUAGES.map((language) => [
    language,
    { app: app[language], bookings: bookings[language] },
  ]),
);

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "app";
    resources: { app: typeof en; bookings: typeof bookings.en };
  }
}

/** The first of the browser's languages the site offers, or the default. */
export function browserLanguage(
  wanted: readonly string[] = navigator.languages,
): Language {
  for (const tag of wanted) {
    const base = tag.toLowerCase().split("-")[0];
    const offered = LANGUAGES.find((language) => language === base);
    if (offered) return offered;
  }
  return LANGUAGES[0];
}

/** The visitor's choice from the header, else their browser's. */
const chosenLanguage = () =>
  usePreferences.getState().language ?? browserLanguage();

/**
 * Call once at startup, before the first render. A function, not code that
 * runs on import: the app's package.json declares its modules free of side
 * effects, so the build would drop a bare `import "./i18n"`.
 */
export function startI18n() {
  if (i18n.isInitialized) return;
  void i18n.use(initReactI18next).init({
    resources,
    lng: chosenLanguage(),
    fallbackLng: LANGUAGES[0],
    supportedLngs: LANGUAGES,
    defaultNS: "app",
    ns: ["app", "bookings"],
    // React escapes what it renders.
    interpolation: { escapeValue: false },
    // The messages are bundled: ready before the first render.
    initAsync: false,
  });

  // Screen readers pronounce, and browsers hyphenate and translate, by <html lang>.
  document.documentElement.lang = i18n.language;
  i18n.on("languageChanged", (language) => {
    document.documentElement.lang = language;
  });
  usePreferences.subscribe(() => {
    const language = chosenLanguage();
    if (language !== i18n.language) void i18n.changeLanguage(language);
  });
}

export { i18n };
