import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The theme's type utilities (src/styles.css) are sizes: without this,
// tailwind-merge reads `text-h2` as a text colour and drops the other one.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "lead"] }],
    },
  },
});

/** Joins class names, letting a later Tailwind class override an earlier one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Adds `base` to a Base UI `className`, which may be a function of the
 * component's state.
 */
export function withBase<State>(
  base: string,
  className: string | ((state: State) => string | undefined) | undefined,
) {
  return typeof className === "function"
    ? (state: State) => cn(base, className(state))
    : cn(base, className);
}
