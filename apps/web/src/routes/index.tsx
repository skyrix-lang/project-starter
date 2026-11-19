import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CircleCheck, Clock } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { buttonVariants, Card } from "@booking/ui";
import { pageFor } from "../overrides";
import { usePageMeta } from "../page-meta";

// A public page: index.html carries its title, description, canonical URL and
// structured data, so crawlers have them before JavaScript runs.

const features = [
  { icon: CalendarDays, key: "scheduling" },
  { icon: Clock, key: "availability" },
  { icon: CircleCheck, key: "confirmation" },
] as const;

function HomePage() {
  usePageMeta({});
  const { t } = useTranslation();
  return (
    <div className="space-y-16">
      <section className="text-center py-12 sm:py-20">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          <Trans
            i18nKey="home.headline"
            components={{ em: <span className="text-primary" /> }}
          />
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("home.text")}
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link to="/bookings" className={buttonVariants({ size: "lg" })}>
            {t("home.cta")}
          </Link>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.key} className="text-center">
              <div className="mx-auto w-12 h-12 rounded-lg bg-primary-soft flex items-center justify-center mb-4">
                <feature.icon
                  aria-hidden="true"
                  className="h-6 w-6 text-primary"
                />
              </div>
              <h2 className="text-lg font-semibold">
                {t(`home.${feature.key}.title`)}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`home.${feature.key}.text`)}
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
