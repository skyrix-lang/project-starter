import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDaysIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { sharedOpenGraph, site } from "@/lib/site";

const features = [
  {
    icon: CalendarDaysIcon,
    title: "Easy Scheduling",
    description:
      "Book appointments in just a few clicks with our intuitive calendar interface.",
  },
  {
    icon: ClockIcon,
    title: "Real-time Availability",
    description:
      "See available time slots instantly and never double-book again.",
  },
  {
    icon: CheckCircleIcon,
    title: "Instant Confirmation",
    description:
      "Get immediate booking confirmations and reminders for your appointments.",
  },
];

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    ...sharedOpenGraph,
    title: site.name,
    description: site.description,
    url: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  url: site.url,
  description: site.description,
};

export default function Home() {
  return (
    <div className="space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <section className="text-center py-12 sm:py-20">
        <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 tracking-tight">
          Book with <span className="text-primary-600">confidence</span>
        </h1>
        <p className="mt-4 text-lg text-surface-500 max-w-2xl mx-auto">
          The simplest way to manage your bookings. Schedule, track, and
          organize all your appointments in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/bookings" className={buttonStyles({ size: "lg" })}>
            View Bookings
          </Link>
          <Button variant="secondary" size="lg">
            Learn More
          </Button>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <div className="mx-auto w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary-600" />
              </div>
              <h2 className="text-lg font-semibold text-surface-900">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm text-surface-500">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
