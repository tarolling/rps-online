import { describe, expect, it } from "vitest";
import {
  SESSION_REFRESH_WINDOW_MS,
  decodeJwtExp,
  isSessionCookieExpired,
  needsSessionRefresh,
  parseSessionExpiry,
} from "./sessionCookie";

/** Builds an unsigned JWT with the given payload, for decode tests. */
function makeToken(payload: unknown, segments = 3): string {
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_");
  return ["header", encoded, "signature"].slice(0, segments).join(".");
}

describe("parseSessionExpiry", () => {
  it("returns the timestamp for a valid value", () => {
    expect(parseSessionExpiry("1737000000000")).toBe(1737000000000);
  });

  it("returns null for absent or unusable values", () => {
    expect(parseSessionExpiry(null)).toBeNull();
    expect(parseSessionExpiry(undefined)).toBeNull();
    expect(parseSessionExpiry("")).toBeNull();
    expect(parseSessionExpiry("abc")).toBeNull();
    expect(parseSessionExpiry("-1")).toBeNull();
    expect(parseSessionExpiry("0")).toBeNull();
  });
});

describe("needsSessionRefresh", () => {
  const now = 1_700_000_000_000;

  it("renews when there is no session at all", () => {
    expect(needsSessionRefresh(null, now)).toBe(true);
  });

  it("leaves a healthy session alone", () => {
    expect(needsSessionRefresh(now + 5 * 24 * 60 * 60 * 1000, now)).toBe(false);
    expect(needsSessionRefresh(now + SESSION_REFRESH_WINDOW_MS + 1, now)).toBe(false);
  });

  it("renews once inside the window, boundary included", () => {
    expect(needsSessionRefresh(now + SESSION_REFRESH_WINDOW_MS, now)).toBe(true);
    expect(needsSessionRefresh(now + 60_000, now)).toBe(true);
  });

  it("renews an already-expired session", () => {
    expect(needsSessionRefresh(now - 1, now)).toBe(true);
  });
});

describe("decodeJwtExp", () => {
  it("reads exp from a well-formed token", () => {
    expect(decodeJwtExp(makeToken({ exp: 1737000000, uid: "abc" }))).toBe(1737000000);
  });

  it("handles base64url payloads and non-ASCII claims", () => {
    expect(decodeJwtExp(makeToken({ exp: 1737000000, name: "Renée ~~~?" }))).toBe(1737000000);
  });

  it("returns null when the token isn't a readable JWT", () => {
    expect(decodeJwtExp("")).toBeNull();
    expect(decodeJwtExp("not.a.jwt")).toBeNull();
    expect(decodeJwtExp(makeToken({ exp: 1737000000 }, 2))).toBeNull();
  });

  it("returns null when exp is missing or not a number", () => {
    expect(decodeJwtExp(makeToken({ uid: "abc" }))).toBeNull();
    expect(decodeJwtExp(makeToken({ exp: "1737000000" }))).toBeNull();
    expect(decodeJwtExp(makeToken("a string payload"))).toBeNull();
  });
});

describe("isSessionCookieExpired", () => {
  const now = 1_700_000_000_000;

  it("treats a missing cookie as expired", () => {
    expect(isSessionCookieExpired(undefined, now)).toBe(true);
  });

  it("accepts a token that is still live", () => {
    expect(isSessionCookieExpired(makeToken({ exp: now / 1000 + 60 }), now)).toBe(false);
  });

  it("rejects a token at or past its exp", () => {
    expect(isSessionCookieExpired(makeToken({ exp: now / 1000 }), now)).toBe(true);
    expect(isSessionCookieExpired(makeToken({ exp: now / 1000 - 60 }), now)).toBe(true);
  });

  it("treats an unreadable token as expired", () => {
    expect(isSessionCookieExpired("garbage", now)).toBe(true);
  });
});
