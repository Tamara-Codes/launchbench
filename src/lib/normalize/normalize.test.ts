import { describe, expect, it } from "vitest";
import { foldCroatian } from "./diacritics";
import { extractEmails, isValidEmail, normalizeEmail } from "./email";
import { domainFromEmail, normalizeDomain } from "./domain";
import { normalizeUrl, urlHash } from "./url";
import { extractPhones, normalizePhone } from "./phone";
import { nameSimilarity, normalizeBusinessName } from "./name";
import { normalizeQuery } from "./query";

describe("croatian diacritics", () => {
  it("folds all croatian special letters for comparison", () => {
    expect(foldCroatian("Čačić Šđž")).toBe("Cacic Sdz");
    expect(foldCroatian("Malinska")).toBe("Malinska");
    expect(foldCroatian("smještaj")).toBe("smjestaj");
  });
});

describe("email normalization", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Info@Villa-Mare.HR ")).toBe("info@villa-mare.hr");
  });
  it("validates real vs junk", () => {
    expect(isValidEmail("info@villa.hr")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@@b.com")).toBe(false);
    expect(isValidEmail("a..b@x.com")).toBe(false);
  });
  it("extracts and dedupes emails from text, stripping trailing punctuation", () => {
    const text = "Contact us at info@villa.hr or booking@villa.hr. Also info@villa.hr!";
    expect(extractEmails(text)).toEqual(["info@villa.hr", "booking@villa.hr"]);
  });
});

describe("domain normalization", () => {
  it("strips scheme, www, path, port", () => {
    expect(normalizeDomain("https://www.Villa-Mare.hr/kontakt?x=1")).toBe(
      "villa-mare.hr",
    );
    expect(normalizeDomain("HTTP://villa.hr:8080")).toBe("villa.hr");
  });
  it("derives domain from email", () => {
    expect(domainFromEmail("info@www.villa.hr")).toBe("villa.hr");
  });
});

describe("url normalization", () => {
  it("canonicalizes protocol, www, tracking params, trailing slash", () => {
    const a = normalizeUrl("https://www.Villa.hr/kontakt/?utm_source=x&a=1");
    const b = normalizeUrl("https://villa.hr/kontakt?a=1");
    expect(a).toBe(b);
  });
  it("collapses root slash", () => {
    expect(normalizeUrl("https://villa.hr/")).toBe("https://villa.hr");
  });
  it("produces stable hashes for equivalent urls", () => {
    expect(urlHash("https://www.villa.hr/")).toBe(urlHash("https://villa.hr"));
    expect(urlHash("https://villa.hr/a")).not.toBe(urlHash("https://villa.hr/b"));
  });
});

describe("phone normalization", () => {
  it("normalizes croatian national numbers to +385", () => {
    expect(normalizePhone("091 234 5678")).toBe("+385912345678");
    expect(normalizePhone("0912345678")).toBe("+385912345678");
  });
  it("keeps international prefixes", () => {
    expect(normalizePhone("+385 51 123 456")).toBe("+38551123456");
    expect(normalizePhone("0038551123456")).toBe("+38551123456");
  });
  it("rejects too-short numbers", () => {
    expect(normalizePhone("123")).toBe("");
  });
  it("extracts phones from text", () => {
    const phones = extractPhones("Call +385 51 123 456 or 091 234 5678");
    expect(phones).toContain("+38551123456");
    expect(phones).toContain("+385912345678");
  });
});

describe("business name normalization", () => {
  it("drops suffixes, noise words, diacritics", () => {
    expect(normalizeBusinessName("Apartmani Villa Mare d.o.o.")).toBe("mare");
    expect(normalizeBusinessName("Kuća za odmor Čačić")).toBe("cacic");
  });
  it("computes similarity", () => {
    expect(nameSimilarity("Villa Mare", "Villa Marе")).toBeGreaterThan(0.5);
    expect(nameSimilarity("Villa Mare", "Villa Mare")).toBe(1);
    expect(nameSimilarity("Mare", "Sunce")).toBeLessThan(0.5);
  });
});

describe("query normalization", () => {
  it("is order-insensitive and diacritic-insensitive", () => {
    expect(normalizeQuery("apartmani Malinska")).toBe(
      normalizeQuery("Malinska Apartmani"),
    );
    expect(normalizeQuery("smještaj Malinska")).toBe(
      normalizeQuery("smjestaj malinska"),
    );
  });
  it("preserves site: operator", () => {
    expect(normalizeQuery("site:.hr apartmani Malinska")).toContain("site:.hr");
  });
});
