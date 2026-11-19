import { afterEach, describe, expect, it } from "vitest";
import { LANGUAGES } from "@booking/core";
import { browserLanguage, i18n, resources } from "./i18n";
import { usePreferences } from "./preferences";

/**
 * Every key of a messages file, as "a.b.c", plural forms ("x_one", "x_few")
 * counted once: languages have different plural categories.
 */
const keys = (messages: object, prefix = ""): string[] =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key.replace(/_(zero|one|two|few|many|other)$/, "")}`],
  );
const unique = (list: string[]) => [...new Set(list)].sort();

afterEach(() => usePreferences.setState({ language: null }));

describe.each(LANGUAGES.slice(1))("the %s messages", (language) => {
  const english = resources[LANGUAGES[0]]!;
  it.each(Object.keys(english))("have every key of %s", (namespace) => {
    const translated = resources[language]![namespace as keyof typeof english];
    expect(unique(keys(translated))).toEqual(
      unique(keys(english[namespace as keyof typeof english])),
    );
  });
});

describe("browserLanguage", () => {
  it("takes the first language the site offers", () => {
    expect(browserLanguage(["de-DE", "fr-CA", "en"])).toBe("fr");
  });

  it("falls back to the default", () => {
    expect(browserLanguage(["de", "ja"])).toBe(LANGUAGES[0]);
    expect(browserLanguage([])).toBe(LANGUAGES[0]);
  });
});

describe("the chosen language", () => {
  it("switches the texts and <html lang>", async () => {
    usePreferences.getState().setLanguage("fr");
    await waitForLanguage("fr");
    expect(i18n.t("user.signIn")).toBe("Se connecter");
    expect(document.documentElement.lang).toBe("fr");

    usePreferences.getState().setLanguage(null);
    await waitForLanguage("en");
    expect(document.documentElement.lang).toBe("en");
  });
});

async function waitForLanguage(language: string) {
  await expect.poll(() => i18n.language).toBe(language);
}
