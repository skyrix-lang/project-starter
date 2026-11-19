import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BOOKING_STATUSES, type BookingStatus } from "@booking/core";
import { buttonVariants } from "@booking/ui";
import { NAMESPACE } from "./messages";

const filters = ["all", ...BOOKING_STATUSES] as const;

// Links, not buttons: each filter is a URL that can be shared or reloaded.
export function FilterBar({ active }: { active: BookingStatus | "all" }) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <nav
      aria-label={t("filters.label")}
      className="flex flex-wrap items-center gap-2"
    >
      {filters.map((filter) => (
        <Link
          key={filter}
          to="/bookings"
          search={filter === "all" ? {} : { status: filter }}
          aria-current={active === filter ? "page" : undefined}
          className={buttonVariants({
            variant: active === filter ? "primary" : "ghost",
            size: "sm",
          })}
        >
          {t(`filters.${filter}`)}
        </Link>
      ))}
    </nav>
  );
}
