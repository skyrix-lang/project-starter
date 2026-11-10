import { describe, expect, it } from "vitest";
import { isValidSlug, isValidTitle, renameText, titleFromSlug } from "./rename";

const names = { slug: "acme-portal", title: "Acme Portal" };
const rename = (content: string) => renameText(content, names);

describe("renameText", () => {
  it("renames the package scope and the root package", () => {
    expect(rename('import { site } from "@booking/core";')).toBe(
      'import { site } from "@acme-portal/core";',
    );
    expect(rename('"name": "booking-platform",')).toBe(
      '"name": "acme-portal",',
    );
    expect(rename("--exclude booking-platform run check")).toBe(
      "--exclude acme-portal run check",
    );
  });

  it("renames the containers, the realm and the OIDC client", () => {
    expect(rename("docker stop booking-db")).toBe("docker stop acme-portal-db");
    expect(rename("docker start booking-keycloak")).toBe(
      "docker start acme-portal-keycloak",
    );
    expect(rename("OIDC_ISSUER=http://localhost:8180/realms/booking")).toBe(
      "OIDC_ISSUER=http://localhost:8180/realms/acme-portal",
    );
    expect(rename('"realm": "booking",')).toBe('"realm": "acme-portal",');
    expect(rename("OIDC_CLIENT_SECRET=booking-web-dev-secret")).toBe(
      "OIDC_CLIENT_SECRET=acme-portal-web-dev-secret",
    );
  });

  it("renames the database with underscores, which need no quoting", () => {
    expect(rename("postgres://booking:booking@localhost:5432/booking")).toBe(
      "postgres://acme_portal:acme_portal@localhost:5432/acme_portal",
    );
    expect(rename("postgres://booking:booking@db:5432/booking")).toBe(
      "postgres://acme_portal:acme_portal@db:5432/acme_portal",
    );
    expect(rename("-e POSTGRES_USER=booking \\")).toBe(
      "-e POSTGRES_USER=acme_portal \\",
    );
    expect(rename("POSTGRES_DB: booking")).toBe("POSTGRES_DB: acme_portal");
    expect(rename("pg_isready -q -h 127.0.0.1 -U booking;")).toBe(
      "pg_isready -q -h 127.0.0.1 -U acme_portal;",
    );
    expect(rename('"-h", "127.0.0.1", "-U", "booking"]')).toBe(
      '"-h", "127.0.0.1", "-U", "acme_portal"]',
    );
    expect(rename("dev: `booking${suffix}`,")).toBe(
      "dev: `acme_portal${suffix}`,",
    );
    expect(rename("e2e: `booking_${checkoutSlot()}_e2e`,")).toBe(
      "e2e: `acme_portal_${checkoutSlot()}_e2e`,",
    );
  });

  it("renames the site", () => {
    expect(rename("<title>BookingHub</title>")).toBe(
      "<title>Acme Portal</title>",
    );
  });

  it("renames once when the new name contains one of the starter's", () => {
    for (const slug of [
      "hotel-booking-web",
      "booking-api-gateway",
      "my-booking-platform",
      "booking",
    ]) {
      const to = (content: string) => renameText(content, { slug, title: "X" });
      expect(to('"name": "booking-platform",')).toBe(`"name": "${slug}",`);
      expect(to('from "@booking/core"')).toBe(`from "@${slug}/core"`);
      expect(to("docker stop booking-db")).toBe(`docker stop ${slug}-db`);
      expect(to("OIDC_CLIENT_ID=booking-web")).toBe(
        `OIDC_CLIENT_ID=${slug}-web`,
      );
    }
  });

  it("inserts the display name as it is", () => {
    expect(
      renameText("<title>BookingHub</title>", { slug: "a", title: "A$&B $1" }),
    ).toBe("<title>A$&B $1</title>");
  });

  it("leaves the bookings feature alone", () => {
    for (const kept of [
      'import { BookingCard } from "./booking-card";',
      'export * from "./booking-schema";',
      '<Card data-testid="booking-card">',
      'app.get("/api/bookings", listBookings)',
      "packages/feature-bookings/src/bookings-page.tsx",
      "const booking = await createBooking(userId, input);",
      'pgEnum("booking_status", ["pending"])',
      "https://bookings.example.com",
      "Another user's booking behaves as if it doesn't exist (404).",
    ]) {
      expect(rename(kept)).toBe(kept);
    }
  });
});

describe("isValidSlug", () => {
  it("accepts npm scope and Docker names", () => {
    expect(["acme", "acme-portal", "app2"].every(isValidSlug)).toBe(true);
  });

  it("refuses anything else", () => {
    expect(
      [
        "",
        "Acme",
        "acme_portal",
        "-acme",
        "acme-",
        "2app",
        "a b",
        "@acme",
      ].some(isValidSlug),
    ).toBe(false);
  });
});

describe("isValidTitle", () => {
  it("accepts names made of words", () => {
    expect(
      ["Acme", "Acme Portal", "Réservations 2", "Co-op Desk"].every(
        isValidTitle,
      ),
    ).toBe(true);
  });

  it("refuses what would need escaping in HTML, JSON or code", () => {
    expect(
      [
        "",
        " Acme",
        'Tom "Pro"',
        "A & B",
        "Cash$$Flow",
        "a<b",
        "back\\slash",
        "O'Neil",
      ].some(isValidTitle),
    ).toBe(false);
  });
});

it("titleFromSlug capitalizes each word", () => {
  expect(titleFromSlug("acme-portal")).toBe("Acme Portal");
});
