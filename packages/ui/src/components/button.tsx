import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { withBase } from "../lib/utils";

// Also styles links as buttons: <Link className={buttonVariants()}>. A
// <button> inside a link is invalid HTML.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground border border-input hover:bg-muted shadow-sm",
        ghost: "text-secondary-foreground hover:bg-muted",
        destructive: "bg-destructive text-primary-foreground hover:opacity-90",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
        icon: "p-2",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<typeof BaseButton> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <BaseButton
      className={withBase(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
