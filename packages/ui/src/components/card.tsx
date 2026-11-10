import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-lg border p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
