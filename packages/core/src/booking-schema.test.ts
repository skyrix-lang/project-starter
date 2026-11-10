import { describe, expect, it } from "vitest";
import { createBookingSchema } from "./booking-schema";

const valid = {
  title: "Dentist",
  date: "2030-02-01",
  time: "16:45",
  duration: 20,
};

describe("createBookingSchema", () => {
  it("trims the title and defaults the description", () => {
    expect(
      createBookingSchema.parse({ ...valid, title: "  Dentist " }),
    ).toEqual({ ...valid, description: "" });
  });

  it("drops fields a client may not set", () => {
    const parsed = createBookingSchema.parse({ ...valid, status: "confirmed" });
    expect("status" in parsed).toBe(false);
  });

  const invalid = {
    "an empty title": { title: "   " },
    "an invalid date": { date: "2030-02-30" },
    "seconds in the time": { time: "16:45:00" },
    "a fractional duration": { duration: 1.5 },
    "a duration over a day": { duration: 1441 },
  };
  for (const [name, override] of Object.entries(invalid)) {
    it(`rejects ${name}`, () => {
      const result = createBookingSchema.safeParse({ ...valid, ...override });
      expect(result.success).toBe(false);
    });
  }
});
