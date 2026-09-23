import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "./redirect";

describe("sanitizeNextPath", () => {
  it("accepts same-origin paths", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/clubs/the-rock-club")).toBe("/clubs/the-rock-club");
    expect(sanitizeNextPath("/dashboard?tab=async")).toBe("/dashboard?tab=async");
  });

  it("rejects anything that could leave the origin", () => {
    expect(sanitizeNextPath("https://evil.com")).toBeNull();
    expect(sanitizeNextPath("//evil.com")).toBeNull();
    expect(sanitizeNextPath("/\\evil.com")).toBeNull();
    expect(sanitizeNextPath("javascript:alert(1)")).toBeNull();
    expect(sanitizeNextPath("dashboard")).toBeNull();
  });

  it("rejects paths that would loop back to an auth page", () => {
    expect(sanitizeNextPath("/login")).toBeNull();
    expect(sanitizeNextPath("/login?next=%2Fdashboard")).toBeNull();
    expect(sanitizeNextPath("/register")).toBeNull();
  });

  it("does not reject paths that merely start with the same letters", () => {
    expect(sanitizeNextPath("/loginhelp")).toBe("/loginhelp");
  });

  it("returns null for empty input", () => {
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath(undefined)).toBeNull();
    expect(sanitizeNextPath("")).toBeNull();
  });
});
