import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-redirect";
import { validatePublicUrl } from "./ssrf";
import { safeErrorMessage } from "./redact";

describe("OAuth return-path protection", () => {
  const appUrl = "https://app.example.com/auth/callback";

  it("keeps normal same-origin application paths", () => {
    expect(safeInternalPath("/app/products?new=1#form", appUrl)).toBe("/app/products?new=1#form");
  });

  it.each(["//attacker.example", "https://attacker.example/x", "javascript:alert(1)", "/\\attacker.example", "not-a-path"]) 
  ("rejects attacker-controlled return value %s", (value) => {
    expect(safeInternalPath(value, appUrl)).toBe("/");
  });
});

describe("scraper SSRF protection", () => {
  it.each([
    "http://127.0.0.1/",
    "http://10.0.0.10/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://localhost/",
    "http://printer.local/",
    "https://user:password@example.com/",
    "file:///etc/passwd",
  ])("rejects unsafe target %s", (value) => {
    expect(validatePublicUrl(value).ok).toBe(false);
  });

  it("accepts a normal public HTTPS URL", () => {
    expect(validatePublicUrl("https://example.com/contact")).toMatchObject({ ok: true });
  });
});

describe("error redaction", () => {
  it("does not return a configured provider key to callers", () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "AIzaThisIsOnlyATestKey_123456789";
    try {
      const message = safeErrorMessage(new Error(`provider rejected ${process.env.GEMINI_API_KEY}`));
      expect(message).not.toContain("AIzaThisIsOnlyATestKey_123456789");
      expect(message).toContain("[GEMINI_API_KEY]");
    } finally {
      if (previous === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previous;
    }
  });
});
