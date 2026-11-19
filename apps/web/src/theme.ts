import { useSyncExternalStore } from "react";
import { usePreferences, type Theme } from "./preferences";

// Light or dark: the theme's `.dark` block (packages/theme-*) applies when
// <html> has the class. "system" follows the operating system, live.
// public/theme.js sets it before the first paint, so a dark page doesn't
// flash white; this keeps it in step afterwards.

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function isDark(theme: Theme) {
  return theme === "dark" || (theme === "system" && darkQuery().matches);
}

function apply() {
  document.documentElement.classList.toggle(
    "dark",
    isDark(usePreferences.getState().theme),
  );
}

function subscribeToSystem(onChange: () => void) {
  const query = darkQuery();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Call once at startup. */
export function startTheme() {
  apply();
  usePreferences.subscribe(apply);
  darkQuery().addEventListener("change", apply);
}

/** Whether the page is dark now, and a switch to the other one. */
export function useTheme() {
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);
  // Re-render when the system switches, so "system" stays accurate.
  const systemDark = useSyncExternalStore(
    subscribeToSystem,
    () => darkQuery().matches,
  );
  const dark = theme === "dark" || (theme === "system" && systemDark);
  return { dark, toggle: () => setTheme(dark ? "light" : "dark") };
}
