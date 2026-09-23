/** Primitive types that can be safely serialized as query string values */
type QueryParamValue = string | number | boolean | null | undefined;

/** An HTTP failure that preserves the status code, so callers can tell a 401 from a 404. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Resolves true if the session was successfully renewed and the request is
 * worth replaying. Registered by AuthProvider (see `setUnauthorizedHandler`).
 */
type UnauthorizedHandler = () => Promise<boolean>;

let onUnauthorized: UnauthorizedHandler | null = null;

/** In-flight recovery, so parallel 401s trigger one token refresh rather than N. */
let recovery: Promise<boolean> | null = null;

/** Recovery runs through these, so retrying them would recurse. */
const AUTH_ENDPOINTS = ["/api/login", "/api/logout"];

/**
 * Registers the callback used to recover from a 401 by renewing the session
 * cookie. Deliberately a registration hook rather than a direct import of
 * `@/lib/firebase`: these helpers also run server-side (gameLogic's
 * `recordRankedGame` self-calls the app's own API routes), and importing the
 * Firebase client SDK here would pull it into the server bundle. Nothing
 * registers a handler on the server, so server-side behavior is unchanged.
 * @param handler - The recovery callback, or null to unregister
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/**
 * Builds a same-origin URL (path + query string). In the browser, a relative
 * path resolves against the current origin automatically. Node's `fetch`
 * (used when these helpers run server-side, e.g. the async game mode's
 * server-driven `recordRankedGame` self-calling its own API routes) has no
 * such notion and throws on a relative URL, so server-side callers get an
 * absolute URL prefixed with `NEXT_PUBLIC_BASE_URL` instead.
 * @param url - The absolute path without the domain prefix
 * @param params - Optional query parameters to append
 */
function buildUrl(url: string, params?: Record<string, QueryParamValue>): string {
  const base = typeof window === "undefined" ? process.env.NEXT_PUBLIC_BASE_URL ?? "" : "";
  const path = params
    ? (() => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== null) searchParams.set(k, String(v));
      });
      const qs = searchParams.toString();
      return qs ? `${url}?${qs}` : url;
    })()
    : url;
  return `${base}${path}`;
}

/**
 * Handles the fetch response, throwing a descriptive ApiError if the request
 * failed. Prefers the `{ error }` string our routes return, since that's
 * written for a human, over the bare status text.
 * @param res - The fetch Response object
 * @param url - The original URL (used in error messages)
 */
async function handleResponse<T>(res: Response, url: string): Promise<T> {
  if (!res.ok) {
    let message: string | undefined;
    try {
      const parsed = JSON.parse(await res.text()) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error) message = parsed.error;
    } catch {
      // Non-JSON error body; fall back to the status text.
    }
    throw new ApiError(message ?? `Request to ${url} failed: ${res.statusText}`, res.status, url);
  }
  return res.json() as Promise<T>;
}

interface RequestOptions {
  body?: Record<string, unknown>;
  params?: Record<string, QueryParamValue>;
  headers?: Record<string, string>;
}

/**
 * Single entry point for every verb, so the 401 recovery lives in one place.
 *
 * On a 401 we give the registered handler one chance to renew the session
 * cookie and replay the request. This is what keeps a long-lived Firebase
 * client session from silently outliving its server session cookie: rather
 * than the UI failing every write while still looking logged in, the cookie
 * is re-minted transparently. `/api/login` is excluded so a failing login
 * can't recurse through its own recovery path.
 */
async function request<T>(
  method: string,
  url: string,
  { body, params, headers }: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json", ...headers };
    init.body = JSON.stringify(body);
  } else if (headers) {
    init.headers = headers;
  }

  // `credentials: "same-origin"` is already the browser default; stated
  // explicitly because the session cookie is the only thing authenticating
  // these calls, and every one of them is same-origin by construction.
  const res = await fetch(buildUrl(url, params), { credentials: "same-origin", ...init });

  if (res.status === 401 && !isRetry && onUnauthorized && !AUTH_ENDPOINTS.includes(url)) {
    // Single-flight: a page firing six requests in parallel must only
    // trigger one token refresh, not six.
    recovery ??= onUnauthorized()
      .catch(() => false)
      .finally(() => { recovery = null; });
    if (await recovery) return request<T>(method, url, { body, params, headers }, true);
  }

  return handleResponse<T>(res, url);
}

/**
 * Sends a GET request and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param params - Optional query parameters to append to the URL
 * @returns The parsed JSON response
 */
export async function getJSON<T = unknown>(url: string, params?: Record<string, QueryParamValue>): Promise<T> {
  return request<T>("GET", url, { params });
}

/**
 * Sends a POST request with a JSON body and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param body - The request body, serialized as JSON
 * @param headers - Optional extra headers (e.g. the internal server-to-server secret)
 * @returns The parsed JSON response
 */
export async function postJSON<T = unknown>(url: string, body: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
  return request<T>("POST", url, { body, headers });
}

/**
 * Sends a PUT request with a JSON body and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param body - The request body, serialized as JSON
 * @returns The parsed JSON response
 */
export async function putJSON<T = unknown>(url: string, body: Record<string, unknown>): Promise<T> {
  return request<T>("PUT", url, { body });
}

/**
 * Sends a PATCH request with a partial JSON body and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param body - The partial request body, serialized as JSON
 * @returns The parsed JSON response
 */
export async function patchJSON<T = unknown>(url: string, body: Record<string, unknown>): Promise<T> {
  return request<T>("PATCH", url, { body });
}

/**
 * Sends a DELETE request and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param params - Optional query parameters to append to the URL
 * @returns The parsed JSON response
 */
export async function deleteJSON<T = unknown>(url: string, params?: Record<string, QueryParamValue>): Promise<T> {
  return request<T>("DELETE", url, { params });
}
