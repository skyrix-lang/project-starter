// The generated client calls this for every request. Same-origin only: the
// session is an HttpOnly cookie, which the browser attaches itself.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  // A proxy's error page is HTML, not JSON: keep it as text.
  const text = await response.text();
  const isJson = response.headers.get("content-type")?.includes("json");
  const body: unknown = text && isJson ? JSON.parse(text) : text || undefined;
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}

// Orval types every hook's error with this: what apiFetch actually throws.
// oxlint-disable-next-line no-unused-vars -- the parameter is Orval's contract
export type ErrorType<_Body> = ApiError;

/**
 * For TanStack Query's `throwOnError`: unexpected errors go to the route's
 * error page. A 401 doesn't (the app sends the user to sign in), nor do the
 * statuses a screen handles itself.
 */
export function throwUnexpected(...handled: number[]) {
  return (error: unknown) =>
    !(error instanceof ApiError && [401, ...handled].includes(error.status));
}
