import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test loads the module afresh: it remembers whether Google's library
// was loaded, as a page does.
async function analytics(id = "G-TEST123") {
  document.head.innerHTML = `<meta name="ga-measurement-id" content="${id}" />`;
  vi.resetModules();
  return import("./analytics");
}

const gaScript = () =>
  document.head.querySelector<HTMLScriptElement>(
    'script[src^="https://www.googletagmanager.com/"]',
  );
/** What the page told gtag.js, as plain arrays. */
const commands = () =>
  (window.dataLayer ?? []).map((entry) => [...(entry as IArguments)]);
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  window.localStorage.clear();
  delete window.dataLayer;
  delete window["ga-disable-G-TEST123"];
});
afterEach(() => vi.useRealTimers());

describe("measurementId", () => {
  it("is off when the server sets none", async () => {
    const { measurementId } = await analytics("");
    expect(measurementId()).toBeUndefined();
  });

  it("is off for anything but a GA4 id", async () => {
    const { measurementId } = await analytics("UA-1234-1");
    expect(measurementId()).toBeUndefined();
  });

  it("reads the id the server wrote into the page", async () => {
    const { measurementId } = await analytics("G-TEST123");
    expect(measurementId()).toBe("G-TEST123");
  });
});

describe("before the visitor answers", () => {
  it("loads nothing from Google", async () => {
    const { startAnalytics } = await analytics();
    startAnalytics();
    expect(gaScript()).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe("accepting", () => {
  it("loads Google's library with Consent Mode: denied by default, then analytics granted", async () => {
    const { chooseAnalytics } = await analytics();
    chooseAnalytics("granted");

    expect(gaScript()?.src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    );
    const sent = commands();
    expect(sent[0]).toEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      },
    ]);
    expect(sent).toContainEqual([
      "consent",
      "update",
      { analytics_storage: "granted" },
    ]);
    expect(sent).toContainEqual(["config", "G-TEST123"]);
    // Advertising is never granted: the banner doesn't ask for it.
    expect(JSON.stringify(sent)).not.toMatch(/"ad_\w+":"granted"/);
  });

  it("is remembered: the next visit measures without asking", async () => {
    (await analytics()).chooseAnalytics("granted");

    const next = await analytics();
    document.head.querySelector("script")?.remove();
    next.startAnalytics();
    expect(gaScript()).not.toBeNull();
  });

  it("loads the library once", async () => {
    const { chooseAnalytics } = await analytics();
    chooseAnalytics("granted");
    chooseAnalytics("granted");
    expect(
      document.head.querySelectorAll('script[src*="googletagmanager"]'),
    ).toHaveLength(1);
  });
});

describe("declining", () => {
  it("loads nothing, and is remembered", async () => {
    (await analytics()).chooseAnalytics("denied");
    expect(gaScript()).toBeNull();

    const next = await analytics();
    next.startAnalytics();
    expect(gaScript()).toBeNull();
  });

  it("after accepting, stops measurement and deletes Google's cookies", async () => {
    const { chooseAnalytics } = await analytics();
    chooseAnalytics("granted");
    document.cookie = "_ga=GA1.1.123; path=/";
    document.cookie = "_ga_TEST123=GS1.1.456; path=/";
    document.cookie = "theme=dark; path=/";

    chooseAnalytics("denied");

    expect(window["ga-disable-G-TEST123"]).toBe(true);
    expect(commands()).toContainEqual([
      "consent",
      "update",
      { analytics_storage: "denied" },
    ]);
    expect(document.cookie).toBe("theme=dark");
    document.cookie = "theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });
});

describe("the stored answer", () => {
  it("is asked again after six months", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { chooseAnalytics, storedChoice } = await analytics();
    chooseAnalytics("denied");

    expect(storedChoice(Date.now() + 180 * DAY)).toBe("denied");
    expect(storedChoice(Date.now() + 183 * DAY)).toBeNull();
  });

  it("is ignored when it isn't one this code wrote", async () => {
    window.localStorage.setItem("analytics-consent", '"granted"');
    const { storedChoice } = await analytics();
    expect(storedChoice()).toBeNull();
  });
});

it("does nothing at all when analytics is off", async () => {
  const { chooseAnalytics, startAnalytics } = await analytics("");
  startAnalytics();
  chooseAnalytics("granted");
  expect(gaScript()).toBeNull();
  expect(window.localStorage.getItem("analytics-consent")).toBeNull();
});
