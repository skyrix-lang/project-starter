import { Field as BaseField } from "@base-ui/react/field";
import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps } from "react";
import { withBase } from "../lib/utils";

// A labelled form control. Base UI links the label, description and error to
// the control (for/aria-describedby), so screen readers announce them.

export function Field({
  className,
  ...props
}: ComponentProps<typeof BaseField.Root>) {
  return (
    <BaseField.Root
      className={withBase("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: ComponentProps<typeof BaseField.Label>) {
  return (
    <BaseField.Label
      className={withBase("text-sm font-medium", className)}
      {...props}
    />
  );
}

export function FieldDescription({
  className,
  ...props
}: ComponentProps<typeof BaseField.Description>) {
  return (
    <BaseField.Description
      className={withBase("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Shown when `match` is true; pass `match` from your form library. */
export function FieldError({
  className,
  ...props
}: ComponentProps<typeof BaseField.Error>) {
  return (
    <BaseField.Error
      className={withBase(
        "text-sm text-destructive-soft-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: ComponentProps<typeof BaseInput>) {
  return (
    <BaseInput
      className={withBase(
        "bg-card w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[invalid]:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
