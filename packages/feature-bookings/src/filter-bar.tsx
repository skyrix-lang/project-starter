import { Link } from "@tanstack/react-router";
import { BOOKING_STATUSES, type BookingStatus } from "@booking/core";
import { buttonVariants } from "@booking/ui";

const filters = ["all", ...BOOKING_STATUSES] as const;

// Links, not buttons: each filter is a URL that can be shared or reloaded.
export function FilterBar({ active }: { active: BookingStatus | "all" }) {
  return (
    <nav
      aria-label="Filter bookings"
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
          {filter.charAt(0).toUpperCase() + filter.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
