import { expect, test } from "@playwright/test";
import type { Booking } from "@/types";
import { createBooking } from "./support";

const validBooking = {
  title: "Dentist",
  date: "2030-02-01",
  time: "16:45",
  duration: 20,
};

test.describe("GET /api/bookings", () => {
  test("lists bookings", async ({ request }) => {
    const response = await request.get("/api/bookings");

    expect(response.status()).toBe(200);
    const bookings: Booking[] = await response.json();
    expect(bookings.map((booking) => booking.title)).toEqual(
      expect.arrayContaining(["Team Sync", "Project Review", "Client Call"]),
    );
  });

  test("filters by status", async ({ request }) => {
    const response = await request.get("/api/bookings?status=pending");

    const bookings: Booking[] = await response.json();
    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings.every((booking) => booking.status === "pending")).toBe(true);
  });

  test("rejects an unknown status", async ({ request }) => {
    const response = await request.get("/api/bookings?status=bogus");

    expect(response.status()).toBe(400);
  });
});

test.describe("POST /api/bookings", () => {
  test("creates a pending booking", async ({ request }) => {
    const response = await request.post("/api/bookings", {
      data: validBooking,
    });

    expect(response.status()).toBe(201);
    const booking: Booking = await response.json();
    expect(booking).toMatchObject({
      ...validBooking,
      description: "",
      status: "pending",
    });
    expect(booking.id).toBeTruthy();
  });

  test("ignores a client-supplied status", async ({ request }) => {
    const booking = await createBooking(request, { status: "confirmed" });

    expect(booking.status).toBe("pending");
  });

  test("rejects malformed JSON", async ({ request }) => {
    const response = await request.post("/api/bookings", {
      headers: { "content-type": "application/json" },
      data: "{not json",
    });

    expect(response.status()).toBe(400);
  });

  const invalidBookings = {
    "an empty title": { title: "   " },
    "an invalid date": { date: "2030-13-45" },
    "an invalid time": { time: "25:00" },
    "a zero duration": { duration: 0 },
    "a fractional duration": { duration: 1.5 },
    "a duration over a day": { duration: 1441 },
  };

  for (const [name, override] of Object.entries(invalidBookings)) {
    test(`rejects ${name}`, async ({ request }) => {
      const response = await request.post("/api/bookings", {
        data: { ...validBooking, ...override },
      });

      expect(response.status()).toBe(400);
    });
  }
});

test.describe("PATCH /api/bookings/:id", () => {
  test("updates the status", async ({ request }) => {
    const { id } = await createBooking(request);

    const response = await request.patch(`/api/bookings/${id}`, {
      data: { status: "confirmed" },
    });

    expect(response.status()).toBe(200);
    expect((await response.json()).status).toBe("confirmed");
  });

  test("rejects an unknown status", async ({ request }) => {
    const { id } = await createBooking(request);

    const response = await request.patch(`/api/bookings/${id}`, {
      data: { status: "bogus" },
    });

    expect(response.status()).toBe(400);
  });

  test("rejects malformed JSON", async ({ request }) => {
    const { id } = await createBooking(request);

    const response = await request.patch(`/api/bookings/${id}`, {
      headers: { "content-type": "application/json" },
      data: "{not json",
    });

    expect(response.status()).toBe(400);
  });

  const unknownIds = {
    "an unknown booking": "00000000-0000-4000-8000-000000000000",
    "an id that isn't a UUID": "does-not-exist",
  };

  for (const [name, id] of Object.entries(unknownIds)) {
    test(`returns 404 for ${name}`, async ({ request }) => {
      const response = await request.patch(`/api/bookings/${id}`, {
        data: { status: "confirmed" },
      });

      expect(response.status()).toBe(404);
    });
  }
});

test.describe("without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("GET returns 401", async ({ request }) => {
    const response = await request.get("/api/bookings");

    expect(response.status()).toBe(401);
  });

  test("POST returns 401 and creates nothing", async ({ request }) => {
    const response = await request.post("/api/bookings", {
      data: validBooking,
    });

    expect(response.status()).toBe(401);
  });

  test("PATCH returns 401", async ({ request }) => {
    const response = await request.patch(
      "/api/bookings/00000000-0000-4000-8000-000000000000",
      { data: { status: "confirmed" } },
    );

    expect(response.status()).toBe(401);
  });
});
