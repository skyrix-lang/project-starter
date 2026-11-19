import { LANGUAGES } from "@booking/core";
import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// What a visitor chose in this browser, kept in localStorage: the pattern for
// any client-only state that should survive a reload. Persisted stores have a
// `version`: bump it and add a `migrate` when the shape changes, so an older
// save still loads. What's read back is checked with Zod, field by field, so
// a value from an older version or edited by hand falls back to its default
// instead of breaking the app. Never keep personal data or secrets here:
// anything on the page can read it.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const storedSchema = z.object({
  theme: z.enum(THEMES).catch("system"),
  /** null: follow the browser's languages. */
  language: z.enum(LANGUAGES).nullable().catch(null),
});
type Stored = z.infer<typeof storedSchema>;

interface Preferences extends Stored {
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Stored["language"]) => void;
}

/** Also read by public/theme.js, before the app loads: keep the two in step. */
export const PREFERENCES_KEY = "preferences";

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: "system",
      language: null,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: PREFERENCES_KEY,
      version: 1,
      partialize: ({ theme, language }) => ({ theme, language }),
      merge: (stored, current) => ({
        ...current,
        ...storedSchema.parse({ ...(stored as object | undefined) }),
      }),
    },
  ),
);
