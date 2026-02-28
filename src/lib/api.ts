/** Primitive types that can be safely serialized as query string values */
type QueryParamValue = string | number | boolean | null | undefined;

/**
 * Builds a full URL by appending the base URL and optional query parameters.
 * @param url - The absolute URL without the domain prefix
 * @param params - Optional query parameters to append
 */
function buildUrl(url: string, params?: Record<string, QueryParamValue>): string {
  const fullUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}${url}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null) fullUrl.searchParams.set(k, String(v));
    });
  }
  return fullUrl.toString();
}

/**
 * Handles the fetch response, throwing a descriptive error if the request failed.
 * @param res - The fetch Response object
 * @param url - The original URL (used in error messages)
 */
async function handleResponse<T>(res: Response, url: string): Promise<T> {
  if (!res.ok) throw new Error(`Request to ${url} failed: ${res.statusText}`);
  return res.json() as Promise<T>;
}

/**
 * Sends a GET request and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param params - Optional query parameters to append to the URL
 * @returns The parsed JSON response
 */
export async function getJSON<T = unknown>(url: string, params?: Record<string, QueryParamValue>): Promise<T> {
  const fullUrl = buildUrl(url, params);
  const res = await fetch(fullUrl);
  return handleResponse<T>(res, url);
}

/**
 * Sends a POST request with a JSON body and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param body - The request body, serialized as JSON
 * @returns The parsed JSON response
 */
export async function postJSON<T = unknown>(url: string, body: Record<string, unknown>): Promise<T> {
  const fullUrl = buildUrl(url);
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, url);
}

/**
 * Sends a PUT request with a JSON body and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param body - The request body, serialized as JSON
 * @returns The parsed JSON response
 */
export async function putJSON<T = unknown>(url: string, body: Record<string, unknown>): Promise<T> {
  const fullUrl = buildUrl(url);
  const res = await fetch(fullUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, url);
}

/**
 * Sends a PATCH request with a partial JSON body and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param body - The partial request body, serialized as JSON
 * @returns The parsed JSON response
 */
export async function patchJSON<T = unknown>(url: string, body: Record<string, unknown>): Promise<T> {
  const fullUrl = buildUrl(url);
  const res = await fetch(fullUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, url);
}

/**
 * Sends a DELETE request and returns the parsed JSON response.
 * @param url - The absolute URL without the domain prefix
 * @param params - Optional query parameters to append to the URL
 * @returns The parsed JSON response
 */
export async function deleteJSON<T = unknown>(url: string, params?: Record<string, QueryParamValue>): Promise<T> {
  const fullUrl = buildUrl(url, params);
  const res = await fetch(fullUrl, { method: "DELETE" });
  return handleResponse<T>(res, url);
}