/**
 * Where to go after signing in. Only a path on this site is accepted, so a
 * crafted link can't send people elsewhere. Browsers drop tabs and newlines
 * when they parse a URL ("/\t/evil.example" becomes "//evil.example"), so any
 * control character is refused too.
 */
export function safeReturnTo(value: unknown, fallback = "/bookings") {
  if (typeof value !== "string") return fallback;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    // oxlint-disable-next-line no-control-regex -- refusing them is the point
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }
  return value;
}
