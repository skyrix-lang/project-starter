import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm",
  secondary:
    "bg-white text-surface-700 border border-surface-300 hover:bg-surface-50 active:bg-surface-100 shadow-sm",
  ghost: "text-surface-600 hover:bg-surface-100 active:bg-surface-200",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

// Also used to style links as buttons: a <button> inside a <Link> is invalid HTML.
export function buttonStyles({
  variant = "primary",
  size = "md",
}: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return `inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]}`;
}

export function Button({
  variant,
  size,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${buttonStyles({ variant, size })} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
