// WCAG 2.2 contrast between a theme's colour tokens, used by
// theme-contrast.test.ts on every packages/theme-*/src/theme.css.

/** Text colour, then each background it is drawn on (4.5:1). */
export const TEXT_PAIRS: [color: string, on: string[]][] = [
  ["foreground", ["background", "card", "muted"]],
  ["card-foreground", ["card"]],
  ["muted-foreground", ["background", "card", "muted"]],
  ["primary", ["background", "card"]],
  ["primary-foreground", ["primary", "primary-hover", "destructive"]],
  ["primary-soft-foreground", ["primary-soft"]],
  // Ghost buttons sit on any surface and turn muted on hover.
  ["secondary-foreground", ["secondary", "background", "card", "muted"]],
  ["success-soft-foreground", ["success-soft"]],
  ["warning-soft-foreground", ["warning-soft"]],
  // Error messages appear on the page as well as in their own box.
  ["destructive-soft-foreground", ["destructive-soft", "background", "card"]],
];

/**
 * What identifies a control or its state (3:1, WCAG 1.4.11): an input's
 * border, the focus ring, a filled button against the page, and an invalid
 * field's border.
 */
export const SHAPE_PAIRS: [color: string, on: string[]][] = [
  ["input", ["background", "card"]],
  ["ring", ["background", "card"]],
  ["primary", ["background", "card"]],
  ["destructive", ["background", "card"]],
];

export type Tokens = Record<string, string>;

function luminance(hex: string) {
  const digits =
    hex.length === 4
      ? hex.slice(1).replace(/./g, (digit) => digit + digit)
      : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((start) => {
    const channel = parseInt(digits.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** The WCAG contrast ratio of two #rgb or #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** Hex colours only: a token written as rgb(), hsl() or oklch() is not read. */
const readColors = (body: string): Tokens =>
  Object.fromEntries(
    [
      ...body.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?)\s*;/gi),
    ].map((match) => [match[1]!, match[2]!.toLowerCase()]),
  );

/**
 * The theme's modes: `light` from the top-level `:root`, then each other block
 * that sets colours (a dark `@media` query, a `.dark` or `[data-theme]`
 * selector) laid over it, as the browser would.
 */
export function themes(css: string): { name: string; tokens: Tokens }[] {
  const blocks: { name: string; tokens: Tokens }[] = [];
  const preludes: string[] = [];
  let start = 0;
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "{") {
      preludes.push(source.slice(start, index).trim());
      start = index + 1;
    } else if (char === "}") {
      const selector = preludes.pop() ?? "";
      const tokens = readColors(source.slice(start, index));
      start = index + 1;
      if (Object.keys(tokens).length === 0) continue;
      const media = preludes.join(" ");
      const name =
        selector === ":root" && !media
          ? "light"
          : /prefers-color-scheme:\s*dark/.test(media)
            ? "dark"
            : selector;
      blocks.push({ name, tokens });
    }
  }
  const light = blocks.find((block) => block.name === "light");
  if (!light) return [];
  return [
    light,
    ...blocks
      .filter((block) => block !== light)
      .map(({ name, tokens }) => ({
        name,
        tokens: { ...light.tokens, ...tokens },
      })),
  ];
}

/** The pairs below `minimum`, as "text on background (ratio)": empty when all pass. */
export function failingPairs(
  tokens: Tokens,
  pairs: [color: string, on: string[]][],
  minimum: number,
) {
  return pairs.flatMap(([color, backgrounds]) =>
    backgrounds.flatMap((background) => {
      const [a, b] = [tokens[color], tokens[background]];
      if (!a || !b) return [];
      const ratio = contrast(a, b);
      return ratio < minimum
        ? [`${color} on ${background} (${ratio.toFixed(2)}:1)`]
        : [];
    }),
  );
}
