import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Booking, CreateBooking } from "@booking/api";
import {
  getCreateBookingMockHandler,
  getListBookingsMockHandler,
  getUpdateBookingMockHandler,
} from "@booking/api/mocks";
import { server } from "@booking/api/test-server";
import { BookingsPage } from "./bookings-page";
import { renderPage } from "./test-utils";

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "6f1c1b7e-2f0a-4c55-9b7c-1d2e3f4a5b6c",
  title: "Team Sync",
  description: "Weekly standup",
  date: "2030-03-10",
  time: "09:00",
  duration: 30,
  status: "pending",
  ...overrides,
});

const card = (title: string) =>
  screen
    .getAllByTestId("booking-card")
    .find((element) =>
      within(element).queryByRole("heading", { name: title }),
    )!;

describe("BookingsPage", () => {
  it("lists the bookings", async () => {
    server.use(
      getListBookingsMockHandler([
        booking(),
        booking({ id: "b", title: "Client Call" }),
      ]),
    );
    await renderPage(<BookingsPage />);

    expect(
      await screen.findByRole("heading", { name: "Team Sync" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Client Call" })).toBeVisible();
  });

  it("asks the API for the status in the URL", async () => {
    let requested: string | null = null;
    server.use(
      getListBookingsMockHandler(({ request }) => {
        requested = new URL(request.url).searchParams.get("status");
        return [booking({ status: "confirmed" })];
      }),
    );
    await renderPage(<BookingsPage status="confirmed" />);

    await screen.findByRole("heading", { name: "Team Sync" });
    expect(requested).toBe("confirmed");
    const filters = screen.getByRole("navigation", { name: "Filter bookings" });
    expect(
      within(filters).getByRole("link", { name: "Confirmed" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("says so when there are none", async () => {
    server.use(getListBookingsMockHandler([]));
    await renderPage(<BookingsPage />);

    expect(await screen.findByText("No bookings found.")).toBeVisible();
  });

  it("confirms a booking, then shows the refreshed list", async () => {
    let current = booking();
    server.use(
      getListBookingsMockHandler(() => [current]),
      getUpdateBookingMockHandler(async ({ request }) => {
        current = {
          ...current,
          ...((await request.json()) as Partial<Booking>),
        };
        return current;
      }),
    );
    await renderPage(<BookingsPage />);
    await screen.findByRole("heading", { name: "Team Sync" });

    await userEvent.click(
      within(card("Team Sync")).getByRole("button", { name: "Confirm" }),
    );

    await waitFor(() =>
      expect(within(card("Team Sync")).getByText("confirmed")).toBeVisible(),
    );
    expect(
      within(card("Team Sync")).queryByRole("button", { name: "Confirm" }),
    ).toBeNull();
  });

  it("drops a booking that was removed meanwhile", async () => {
    let bookings = [booking()];
    server.use(
      getListBookingsMockHandler(() => bookings),
      http.patch("*/api/bookings/:id", () => {
        bookings = [];
        return HttpResponse.json(
          { error: "Booking not found" },
          { status: 404 },
        );
      }),
    );
    await renderPage(<BookingsPage />);
    await screen.findByRole("heading", { name: "Team Sync" });

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("No bookings found.")).toBeVisible();
  });

  describe("new booking form", () => {
    it("checks the fields before sending anything", async () => {
      server.use(getListBookingsMockHandler([]));
      await renderPage(<BookingsPage />);
      await userEvent.click(
        await screen.findByRole("button", { name: "New booking" }),
      );

      await userEvent.click(
        screen.getByRole("button", { name: "Save booking" }),
      );

      expect(await screen.findByText("Enter a title.")).toBeVisible();
      expect(screen.getByText("Enter a valid date.")).toBeVisible();
      expect(screen.getByLabelText("Title")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });

    it("creates a booking and closes", async () => {
      let sent: CreateBooking | undefined;
      server.use(
        getListBookingsMockHandler(() =>
          sent ? [booking({ title: sent.title })] : [],
        ),
        getCreateBookingMockHandler(async ({ request }) => {
          sent = (await request.json()) as CreateBooking;
          return booking({ title: sent.title });
        }),
      );
      await renderPage(<BookingsPage />);
      await userEvent.click(
        await screen.findByRole("button", { name: "New booking" }),
      );

      await userEvent.type(screen.getByLabelText("Title"), "  Dentist ");
      await userEvent.type(screen.getByLabelText("Date"), "2030-02-01");
      await userEvent.type(screen.getByLabelText("Time"), "16:45");
      await userEvent.type(screen.getByLabelText("Duration (minutes)"), "20");
      await userEvent.click(
        screen.getByRole("button", { name: "Save booking" }),
      );

      expect(
        await screen.findByRole("heading", { name: "Dentist" }),
      ).toBeVisible();
      expect(sent).toEqual({
        title: "Dentist",
        description: "",
        date: "2030-02-01",
        time: "16:45",
        duration: 20,
      });
      expect(screen.queryByRole("button", { name: "Save booking" })).toBeNull();
    });
  });
});
