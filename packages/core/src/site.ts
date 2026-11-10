// What the site calls itself. The public address is configuration, read by the
// BFF from PUBLIC_URL when the container starts, not baked into the build.
export const site = {
  name: "BookingHub",
  description:
    "The simplest way to manage your bookings. Schedule, track, and organize all your appointments in one place.",
};

/** Pages that should rank: listed in the sitemap. App pages aren't. */
export const PUBLIC_PATHS = ["/"] as const;
