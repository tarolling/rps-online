import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getJSON, postJSON, setUnauthorizedHandler } from "./api";

/** Minimal stand-in for the bits of Response that handleResponse reads. */
function jsonResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? "Unauthorized" : "Error",
    json: async () => JSON.parse(text),
    text: async () => text,
  } as Response;
}

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("returns the parsed body on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { ok: true })));
    await expect(getJSON("/api/thing")).resolves.toEqual({ ok: true });
  });

  it("throws an ApiError carrying the status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, { error: "Player not found." })));
    await expect(getJSON("/api/thing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Player not found.",
    });
  });

  it("falls back to the status text when the error body has no message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, {})));
    await expect(getJSON("/api/thing")).rejects.toThrow("Request to /api/thing failed: Error");
  });
});

describe("401 recovery", () => {
  it("throws immediately when no handler is registered", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJSON("/api/thing")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once when the handler renews the session", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(async () => true);

    await expect(getJSON("/api/thing")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry rather than looping", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(async () => true);

    await expect(getJSON("/api/thing")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the handler cannot renew", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(async () => false);

    await expect(getJSON("/api/thing")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a throwing handler as a failed renewal", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(async () => { throw new Error("offline"); });

    await expect(getJSON("/api/thing")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never recurses through the auth endpoints themselves", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "Invalid token" }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn(async () => true);
    setUnauthorizedHandler(handler);

    await expect(postJSON("/api/login", { idToken: "x" })).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renews once for concurrent 401s, not once per request", async () => {
    let renewed = false;
    vi.stubGlobal("fetch", vi.fn(async () => (renewed ? jsonResponse(200, { ok: true }) : jsonResponse(401, {}))));
    const handler = vi.fn(async () => { renewed = true; return true; });
    setUnauthorizedHandler(handler);

    const results = await Promise.all([
      getJSON("/api/a"),
      getJSON("/api/b"),
      getJSON("/api/c"),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
