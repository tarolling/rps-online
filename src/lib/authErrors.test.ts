import { describe, expect, it } from "vitest";
import { authErrorCode, authErrorMessage, isUserCanceled } from "./authErrors";

describe("authErrorCode", () => {
  it("reads a Firebase error code", () => {
    expect(authErrorCode({ code: "auth/invalid-credential" })).toBe("auth/invalid-credential");
  });

  it("returns null when there isn't one", () => {
    expect(authErrorCode(null)).toBeNull();
    expect(authErrorCode(undefined)).toBeNull();
    expect(authErrorCode("boom")).toBeNull();
    expect(authErrorCode(new Error("boom"))).toBeNull();
    expect(authErrorCode({ code: 42 })).toBeNull();
  });
});

describe("authErrorMessage", () => {
  it("maps known codes to human copy", () => {
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toBe("Incorrect email or password.");
    expect(authErrorMessage({ code: "auth/wrong-password" })).toBe("Incorrect email or password.");
    expect(authErrorMessage({ code: "auth/too-many-requests" }))
      .toBe("Too many attempts. Wait a few minutes and try again.");
  });

  it("falls back for an unknown code", () => {
    expect(authErrorMessage({ code: "auth/something-new" })).toBe("Something went wrong. Please try again.");
  });

  it("never leaks a raw Firebase message", () => {
    const raw = { code: "auth/unmapped", message: "Firebase: Error (auth/unmapped)." };
    expect(authErrorMessage(raw)).toBe("Something went wrong. Please try again.");
    // Even with no code to key off, a Firebase-shaped message stays hidden.
    expect(authErrorMessage({ message: "Firebase: Error (auth/unmapped)." }))
      .toBe("Something went wrong. Please try again.");
  });

  it("passes through our own API copy, which has no Firebase code", () => {
    expect(authErrorMessage(new Error("Username is already taken."))).toBe("Username is already taken.");
  });

  it("falls back for values that aren't errors at all", () => {
    expect(authErrorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(authErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
    expect(authErrorMessage("boom")).toBe("Something went wrong. Please try again.");
  });

  it("honors a caller-supplied fallback", () => {
    expect(authErrorMessage({ code: "auth/unmapped" }, "Could not sign you up.")).toBe("Could not sign you up.");
  });
});

describe("isUserCanceled", () => {
  it("recognizes the user-dismissed-the-popup codes", () => {
    expect(isUserCanceled({ code: "auth/popup-closed-by-user" })).toBe(true);
    expect(isUserCanceled({ code: "auth/cancelled-popup-request" })).toBe(true);
  });

  it("is false for real failures", () => {
    expect(isUserCanceled({ code: "auth/network-request-failed" })).toBe(false);
    expect(isUserCanceled(new Error("boom"))).toBe(false);
  });
});
