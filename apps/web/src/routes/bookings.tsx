import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { bookingStatusSchema } from "@booking/core";
import { BookingsPage } from "@booking/feature-bookings";
import { requireUser } from "../auth";
import { pageFor } from "../overrides";
import { usePageMeta } from "../page-meta";

// An unknown status shows every booking rather than an error.
const searchSchema = z.object({
  status: bookingStatusSchema.optional().catch(undefined),
});

const Page = pageFor("/bookings", BookingsPage);

export const Route = createFileRoute("/bookings")({
  validateSearch: searchSchema,
  beforeLoad: ({ context, location }) =>
    requireUser(context.queryClient, location.href),
  component: function BookingsRoute() {
    const { t } = useTranslation();
    usePageMeta({ title: t("bookings.title"), noindex: true });
    const { status } = Route.useSearch();
    return <Page status={status} />;
  },
});
