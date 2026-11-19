import en from "./locales/en.json";
import fr from "./locales/fr.json";

/**
 * This feature's texts, one file per language in `locales/`: the app
 * registers them as the `bookings` namespace (apps/web/src/i18n.ts). Add a
 * language by adding its file here and to `LANGUAGES` in @booking/core.
 */
export const messages = { en, fr };
export const NAMESPACE = "bookings";
