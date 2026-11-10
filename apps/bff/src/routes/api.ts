import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import {
  bookingIdSchema,
  bookingSchema,
  bookingStatusSchema,
  createBookingSchema,
  updateBookingSchema,
} from "@booking/core";
import { createBooking, getBookings, updateBookingStatus } from "../bookings";
import { isDatabaseReachable } from "../health";
import { getSessionUser, type SessionUser } from "../session";

// The JSON API. Every route is declared with its schemas, which validate the
// request and make up the OpenAPI document (/api/openapi.json) that
// packages/api generates the web client from. Data is per user: every call
// passes user.id to the data layer, which filters by it.

export type ApiEnv = { Variables: { user: SessionUser } };

const errorSchema = z
  .object({ error: z.string(), issues: z.array(z.unknown()).optional() })
  .meta({ id: "ApiErrorBody" });

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

const unauthorized = errorResponse("Not signed in");

const meSchema = z
  .object({
    user: z
      .object({ email: z.string().nullable(), name: z.string().nullable() })
      .nullable(),
  })
  .meta({ id: "Me" });

const listBookings = createRoute({
  method: "get",
  path: "/bookings",
  operationId: "listBookings",
  request: { query: z.object({ status: bookingStatusSchema.optional() }) },
  responses: {
    200: json(z.array(bookingSchema), "The user's bookings, in date order"),
    400: errorResponse("Invalid request"),
    401: unauthorized,
  },
});

const createBookingRoute = createRoute({
  method: "post",
  path: "/bookings",
  operationId: "createBooking",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createBookingSchema } },
    },
  },
  responses: {
    201: json(bookingSchema, "The new booking, always pending"),
    400: errorResponse("Invalid request"),
    401: unauthorized,
  },
});

const updateBookingRoute = createRoute({
  method: "patch",
  path: "/bookings/{id}",
  operationId: "updateBooking",
  request: {
    // Any string: an id that isn't a UUID is a booking that doesn't exist (404).
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: updateBookingSchema } },
    },
  },
  responses: {
    200: json(bookingSchema, "The updated booking"),
    400: errorResponse("Invalid request"),
    401: unauthorized,
    404: errorResponse("No such booking for this user"),
  },
});

const meRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "getMe",
  responses: {
    // 200 with null rather than 401: the header asks on every page, and a 401
    // would be logged as an error by the browser.
    200: json(meSchema, "The signed-in user, or null"),
  },
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  responses: {
    200: json(z.object({ status: z.literal("ok") }), "The database answers"),
    503: json(z.object({ status: z.literal("unavailable") }), "It doesn't"),
  },
});

const publicApi = new OpenAPIHono()
  // Public on purpose, for load balancers and uptime checks: it says only
  // whether the app can reach its database. 503 tells them to stop sending traffic.
  .openapi(healthRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    return (await isDatabaseReachable())
      ? c.json({ status: "ok" as const }, 200)
      : c.json({ status: "unavailable" as const }, 503);
  })
  .openapi(meRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getSessionUser(c);
    return c.json(
      { user: user ? { email: user.email, name: user.name } : null },
      200,
    );
  });

const userApi = new OpenAPIHono<ApiEnv>({
  // A request that fails its schema gets this API's error shape.
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid request", issues: result.error.issues },
        400,
      );
    }
  },
});

// Each route checks the session: every one of them is a public endpoint.
userApi.use(async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  c.header("Cache-Control", "no-store");
  await next();
});

userApi
  .openapi(listBookings, async (c) => {
    const { status } = c.req.valid("query");
    return c.json(await getBookings(c.var.user.id, status), 200);
  })
  .openapi(createBookingRoute, async (c) => {
    const booking = await createBooking(c.var.user.id, c.req.valid("json"));
    return c.json(booking, 201);
  })
  .openapi(updateBookingRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const bookingId = bookingIdSchema.safeParse(id);
    const booking = bookingId.success
      ? await updateBookingStatus(c.var.user.id, bookingId.data, status)
      : undefined;
    if (!booking) return c.json({ error: "Booking not found" }, 404);
    return c.json(booking, 200);
  });

export const api = new OpenAPIHono();
api.route("/", publicApi);
api.route("/", userApi);

/** The OpenAPI document for this API, with paths under /api. */
export function openApiDocument() {
  const document = new OpenAPIHono();
  document.route("/api", api);
  return document.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "BookingHub API", version: "1.0.0" },
  });
}
