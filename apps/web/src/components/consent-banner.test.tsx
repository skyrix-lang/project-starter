/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The banner with the footer, as the root layout renders them. Each test loads
// the modules afresh, with or without a measurement id in the page.
async function renderPage(id: string) {
  document.head.innerHTML = `<meta name="ga-measurement-id" content="${id}" />`;
  vi.resetModules();
  const [{ ConsentBanner }, { Footer }, { startAnalytics }] = await Promise.all(
    [import("./consent-banner"), import("./footer"), import("../analytics")],
  );
  startAnalytics();
  render(
    <>
      <Footer />
      <ConsentBanner />
    </>,
  );
}

const banner = () => screen.queryByRole("region", { name: "Cookies" });

beforeEach(() => {
  window.localStorage.clear();
  delete window.dataLayer;
});

describe("without a measurement id", () => {
  it("shows no banner and no cookie settings", async () => {
    await renderPage("");

    expect(banner()).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Cookie settings" }),
    ).toBeNull();
  });
});

describe("with a measurement id", () => {
  it("asks on the first visit, without taking focus", async () => {
    await renderPage("G-TEST123");

    expect(banner()).toBeInTheDocument();
    expect(banner()).toHaveAccessibleDescription(/Google Analytics/);
    expect(document.activeElement).toBe(document.body);
  });

  it("closes on an answer, and focus moves to cookie settings", async () => {
    await renderPage("G-TEST123");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(banner()).toBeNull();
    expect(
      screen.getByRole("button", { name: "Cookie settings" }),
    ).toHaveFocus();
  });

  it("doesn't ask again once answered", async () => {
    window.localStorage.setItem(
      "analytics-consent",
      JSON.stringify({ choice: "denied", at: Date.now() }),
    );
    await renderPage("G-TEST123");

    expect(banner()).toBeNull();
  });

  it("opens again from cookie settings, focused, and Escape closes it", async () => {
    window.localStorage.setItem(
      "analytics-consent",
      JSON.stringify({ choice: "denied", at: Date.now() }),
    );
    await renderPage("G-TEST123");
    const user = userEvent.setup();
    const settings = screen.getByRole("button", { name: "Cookie settings" });

    await user.click(settings);
    expect(banner()).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(banner()).toBeNull();
    expect(settings).toHaveFocus();
  });

  it("can't be dismissed with Escape before an answer", async () => {
    await renderPage("G-TEST123");
    const user = userEvent.setup();

    await user.tab();
    await user.keyboard("{Escape}");

    expect(banner()).toBeInTheDocument();
  });

  it("changes a refusal into an agreement", async () => {
    window.localStorage.setItem(
      "analytics-consent",
      JSON.stringify({ choice: "denied", at: Date.now() }),
    );
    await renderPage("G-TEST123");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Cookie settings" }));
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(banner()).toBeNull();
    expect(
      document.head.querySelector('script[src*="googletagmanager"]'),
    ).not.toBeNull();
  });
});
