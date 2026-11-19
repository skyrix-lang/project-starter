import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PREFERENCES_KEY, usePreferences } from "./preferences";
import { isDark, startTheme } from "./theme";

const stored = () =>
  JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "null");

afterEach(() => {
  usePreferences.setState({ theme: "system", language: null });
  window.localStorage.clear();
});

describe("preferences", () => {
  it("are kept in localStorage, with a version", () => {
    usePreferences.getState().setTheme("dark");
    expect(stored()).toEqual({
      state: { theme: "dark", language: null },
      version: 1,
    });
  });

  it("fall back to defaults for a value they don't know", async () => {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ state: { theme: "neon", language: "fr" }, version: 1 }),
    );
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState()).toMatchObject({
      theme: "system",
      language: "fr",
    });
  });

  it("survive a value that isn't JSON", async () => {
    window.localStorage.setItem(PREFERENCES_KEY, "{oops");
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().theme).toBe("system");
  });
});

describe("theme", () => {
  let systemDark = false;
  const listeners: (() => void)[] = [];
  beforeEach(() => {
    systemDark = false;
    // jsdom has no matchMedia.
    window.matchMedia = () =>
      ({
        get matches() {
          return systemDark;
        },
        addEventListener: (_: string, listener: () => void) =>
          listeners.push(listener),
      }) as unknown as MediaQueryList;
  });

  it("follows the system until the visitor picks one", () => {
    expect(isDark("system")).toBe(false);
    systemDark = true;
    expect(isDark("system")).toBe(true);
    expect(isDark("light")).toBe(false);
    expect(isDark("dark")).toBe(true);
  });

  it("puts .dark on <html>, and keeps it in step", () => {
    const html = document.documentElement;
    startTheme();
    expect(html).not.toHaveClass("dark");

    usePreferences.getState().setTheme("dark");
    expect(html).toHaveClass("dark");

    usePreferences.getState().setTheme("system");
    expect(html).not.toHaveClass("dark");
    systemDark = true;
    listeners.forEach((listener) => listener());
    expect(html).toHaveClass("dark");
  });
});
