// Static pages are generated at build time, so the URL must be set for the
// build, not just at runtime. Without it, production pages would tell search
// engines that their canonical address is localhost.
const url = process.env.NEXT_PUBLIC_SITE_URL;
if (!url && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_SITE_URL must be set when building");
}

export const site = {
  name: "BookingHub",
  description:
    "The simplest way to manage your bookings. Schedule, track, and organize all your appointments in one place.",
  url: (url || "http://localhost:3000").replace(/\/$/, ""),
};

// A page's `openGraph` replaces the layout's rather than merging with it, so
// public pages spread this and add their own title and url.
export const sharedOpenGraph = {
  type: "website",
  siteName: site.name,
} as const;
