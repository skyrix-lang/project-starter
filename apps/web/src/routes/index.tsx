import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CircleCheck, Clock } from "lucide-react";
import { buttonVariants, Card } from "@booking/ui";
import { pageFor } from "../overrides";
import { usePageMeta } from "../page-meta";

// A public page: index.html carries its title, description, canonical URL and
// structured data, so crawlers have them before JavaScript runs.

const features = [
  {
    icon: CalendarDays,
    title: "Easy Scheduling",
    description:
      "Book appointments in just a few clicks with our intuitive calendar interface.",
  },
  {
    icon: Clock,
    title: "Real-time Availability",
    description:
      "See available time slots instantly and never double-book again.",
  },
  {
    icon: CircleCheck,
    title: "Instant Confirmation",
    description:
      "Get immediate booking confirmations and reminders for your appointments.",
  },
];

function HomePage() {
  usePageMeta({});
  return (
    <div className="space-y-16">
      <section className="text-center py-12 sm:py-20">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Book with <span className="text-primary">confidence</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          The simplest way to manage your bookings. Schedule, track, and
          organize all your appointments in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link to="/bookings" className={buttonVariants({ size: "lg" })}>
            View Bookings
          </Link>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <div className="mx-auto w-12 h-12 rounded-lg bg-primary-soft flex items-center justify-center mb-4">
                <feature.icon
                  aria-hidden="true"
                  className="h-6 w-6 text-primary"
                />
              </div>
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: pageFor("/", HomePage),
});
