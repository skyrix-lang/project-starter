import { brotliCompressSync, constants, gzipSync } from "node:zlib";

// The built SPA ships `.br` and `.gz` copies of its text files
// (apps/web/vite.config.ts), served by `serveStatic({ precompressed: true })`.
// index.html is filled in when the server starts, so it is compressed then,
// once, with the helpers below.

export const ENCODINGS = ["br", "gzip"] as const;
export type Encoding = (typeof ENCODINGS)[number];

/**
 * The encoding to answer with, from the request's Accept-Encoding: the one the
 * client prefers (by `q`), brotli on a tie, none when it accepts neither.
 */
export function negotiateEncoding(
  acceptEncoding: string | undefined,
): Encoding | undefined {
  const weights = new Map<string, number>();
  for (const part of (acceptEncoding ?? "").split(",")) {
    const [name = "", ...parameters] = part.trim().toLowerCase().split(";");
    const q = parameters
      .map((parameter) => parameter.trim().match(/^q=([\d.]+)$/)?.[1])
      .find((value) => value !== undefined);
    if (name) weights.set(name, q === undefined ? 1 : Number(q));
  }
  const weight = (encoding: Encoding) =>
    weights.get(encoding) ?? weights.get("*") ?? 0;
  const best = ENCODINGS.filter((encoding) => weight(encoding) > 0).sort(
    (a, b) => weight(b) - weight(a),
  )[0];
  return best;
}

/** `text` compressed both ways, at the strongest settings: done once, at startup. */
export function precompress(
  text: string,
): Record<Encoding, Uint8Array<ArrayBuffer>> {
  const source = Buffer.from(text);
  return {
    br: new Uint8Array(
      brotliCompressSync(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
        },
      }),
    ),
    gzip: new Uint8Array(
      gzipSync(source, { level: constants.Z_BEST_COMPRESSION }),
    ),
  };
}
