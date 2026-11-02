import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";
import { BOOKING_STATUSES, type BookingStatus } from "@/types";

const filters = ["all", ...BOOKING_STATUSES] as const;

export function FilterBar({ active }: { active: BookingStatus | "all" }) {
  return (
    <nav aria-label="Filter bookings" className="flex items-center gap-2">
      {filters.map((filter) => (
        <Link
          key={filter}
          href={filter === "all" ? "/bookings" : `/bookings?status=${filter}`}
          aria-current={active === filter ? "page" : undefined}
          className={buttonStyles({
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
