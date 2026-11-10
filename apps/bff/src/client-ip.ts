/**
 * The client's address, from `x-forwarded-for`. Each proxy appends the address
 * it received the request from, so the last entry is the one added by the proxy
 * in front of the app, and the earlier ones are whatever the client sent.
 * Without a proxy the client can send anything, so the value can be forged:
 * deploy behind a proxy that sets it.
 */
export function clientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || undefined;
}
