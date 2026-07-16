import { describe, expect, it } from "vitest";
import { classifyLocation } from "./geo";
import { findDuplicate, type KnownRecord } from "./dedupe";
import { qualifyLead } from "./qualify";
import { hasUnresolvedVariables, renderTemplate } from "./templates";
import {
  addDays,
  classifyDue,
  followUpCancellation,
  planFollowUps,
} from "./followups";
import { canTransition, isResumable, isTerminal } from "./run-state";
import { isPublicUrl, isScrapableDomain, validatePublicUrl } from "./ssrf";
import { leadAnalysisSchema } from "@/agents/lead-finder/schema";
import type { QualificationSettings } from "@/db/schema";

const bounds = {
  town: "Malinska",
  includedSettlements: ["Bogovići", "Sveti Vid"],
  excludedSettlements: ["Krk", "Punat"],
};

describe("geographic matching", () => {
  it("accepts the town and included settlements (diacritic-insensitive)", () => {
    expect(classifyLocation("Apartmani u Malinskoj", bounds)).toBe("inTerritory");
    expect(classifyLocation("Bogovici, Malinska", bounds)).toBe("inTerritory");
    expect(classifyLocation("Sveti Vid", bounds)).toBe("inTerritory");
  });
  it("rejects excluded settlements", () => {
    expect(classifyLocation("Grad Krk", bounds)).toBe("excluded");
  });
  it("marks unknown/ambiguous locations for review", () => {
    expect(classifyLocation("Otok Krk, Hrvatska", bounds)).toBe("excluded");
    expect(classifyLocation("Rijeka", bounds)).toBe("ambiguous");
    expect(classifyLocation("", bounds)).toBe("ambiguous");
  });
});

describe("deduplication", () => {
  const known: KnownRecord[] = [
    {
      id: "L1",
      normalizedEmail: "info@villa-mare.hr",
      normalizedDomain: "villa-mare.hr",
      normalizedPhone: "+385912345678",
      normalizedName: "mare",
      locality: "Malinska",
    },
  ];
  it("detects exact email duplicates as confirmed", () => {
    const m = findDuplicate(
      {
        normalizedEmail: "info@villa-mare.hr",
        normalizedDomain: "other.hr",
        normalizedPhone: "",
        normalizedName: "different",
        locality: "Malinska",
      },
      known,
    );
    expect(m?.matchType).toBe("email");
    expect(m?.resolution).toBe("confirmed");
  });
  it("detects domain and phone duplicates", () => {
    expect(
      findDuplicate(
        { normalizedEmail: "", normalizedDomain: "villa-mare.hr", normalizedPhone: "", normalizedName: "", locality: "" },
        known,
      )?.matchType,
    ).toBe("domain");
    expect(
      findDuplicate(
        { normalizedEmail: "", normalizedDomain: "", normalizedPhone: "+385912345678", normalizedName: "", locality: "" },
        known,
      )?.matchType,
    ).toBe("phone");
  });
  it("flags near-duplicate names in same locality as uncertain (never auto-merge)", () => {
    const m = findDuplicate(
      { normalizedEmail: "", normalizedDomain: "", normalizedPhone: "", normalizedName: "maree", locality: "Malinska" },
      known,
    );
    expect(m?.matchType).toBe("fuzzy");
    expect(m?.resolution).toBe("uncertain");
  });
  it("returns null when nothing matches", () => {
    expect(
      findDuplicate(
        { normalizedEmail: "x@y.hr", normalizedDomain: "y.hr", normalizedPhone: "+385998887777", normalizedName: "sunce", locality: "Malinska" },
        known,
      ),
    ).toBeNull();
  });
});

const qSettings: QualificationSettings = {
  requirePublicEmail: true,
  requireWithinTerritory: true,
  requireWebsite: true,
  requireIndependent: false,
  minConfidence: 0.5,
  rejectExistingDigitalGuide: false,
};

function baseAnalysis() {
  return leadAnalysisSchema.parse({
    businessName: "Villa Mare",
    accommodationType: "apartments",
    location: "Malinska",
    isInTargetLocation: true,
    website: "https://villa-mare.hr",
    publicEmail: "info@villa-mare.hr",
    publicPhone: "+385912345678",
    estimatedUnits: 4,
    languages: ["hr", "en", "de"],
    directBooking: true,
    internationalGuestsLikely: true,
    existingDigitalGuideDetected: false,
    qualificationReasons: ["4 units", "multilingual"],
    rejectionReasons: [],
    confidence: 0.8,
    verifiedFacts: ["4 apartments"],
    inferredFacts: [],
    unknownFields: [],
    sourceEvidence: [{ url: "https://villa-mare.hr", field: "email", snippet: "info@villa-mare.hr" }],
  });
}

describe("qualification", () => {
  it("qualifies a complete, in-territory lead with a verbatim email", () => {
    const r = qualifyLead({
      analysis: baseAnalysis(),
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Malinska",
    });
    expect(r.outcome).toBe("qualified");
    expect(r.verifiedEmail).toBe("info@villa-mare.hr");
    expect(r.score).toBeGreaterThan(50);
  });
  it("rejects when the email is not verbatim in source text (anti-hallucination)", () => {
    const r = qualifyLead({
      analysis: baseAnalysis(),
      sourceEmails: [], // model claimed an email that appears nowhere
      bounds,
      settings: qSettings,
      locationText: "Malinska",
    });
    expect(r.outcome).toBe("rejected");
    expect(r.verifiedEmail).toBe("");
    expect(r.rejectionReasons.join(" ")).toMatch(/verbatim/i);
  });
  it("marks ambiguous locations as manual review, not qualified", () => {
    const r = qualifyLead({
      analysis: baseAnalysis(),
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Otok Krk",
    });
    expect(r.outcome).toBe("rejected"); // Krk is excluded
  });
  it("sends low-confidence to manual review", () => {
    const a = baseAnalysis();
    a.confidence = 0.4;
    const r = qualifyLead({
      analysis: a,
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Malinska",
    });
    expect(r.outcome).toBe("manualReview");
  });
});

describe("template variables", () => {
  it("resolves present variables and flags empty ones", () => {
    const r = renderTemplate("Hi {{contact_name}} at {{business_name}}", {
      contact_name: "",
      business_name: "Villa Mare",
    });
    expect(r.text).toContain("Villa Mare");
    expect(r.unresolved).toContain("contact_name");
    expect(hasUnresolvedVariables(r.text)).toBe(true);
  });
  it("fully resolves when all provided", () => {
    const r = renderTemplate("Hi {{name}}", { name: "Ana" });
    expect(r.text).toBe("Hi Ana");
    expect(r.unresolved).toHaveLength(0);
    expect(hasUnresolvedVariables(r.text)).toBe(false);
  });
});

describe("follow-up scheduling", () => {
  const rules = {
    firstFollowUpDays: 4,
    finalFollowUpDays: 7,
    maxFollowUps: 2,
    stopAfterReply: true,
    stopAfterOptOut: true,
    stopAfterInvalidAddress: true,
    stopAfterNotInterested: true,
  };
  it("plans first (+4d) and final (+7d after first)", () => {
    const sent = new Date("2026-07-15T10:00:00Z");
    const plan = planFollowUps(sent, rules);
    expect(plan).toHaveLength(2);
    expect(plan[0]!.dueAt).toEqual(addDays(sent, 4));
    expect(plan[1]!.dueAt).toEqual(addDays(sent, 11));
  });
  it("cancels follow-ups after a reply or opt-out", () => {
    expect(followUpCancellation("replied", rules)).toBe("cancelledReply");
    expect(followUpCancellation("optedOut", rules)).toBe("cancelledOptOut");
    expect(followUpCancellation("notInterested", rules)).toBe("cancelledManual");
    expect(followUpCancellation("contacted", rules)).toBeNull();
  });
  it("classifies due buckets", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(classifyDue(new Date("2026-07-14T12:00:00Z"), now)).toBe("overdue");
    expect(classifyDue(new Date("2026-07-15T18:00:00Z"), now)).toBe("dueToday");
    expect(classifyDue(new Date("2026-07-18T12:00:00Z"), now)).toBe("upcoming");
    expect(classifyDue(new Date("2026-08-15T12:00:00Z"), now)).toBe("future");
  });
});

describe("run state machine", () => {
  it("allows legal forward transitions and blocks illegal ones", () => {
    expect(canTransition("queued", "planning")).toBe(true);
    expect(canTransition("searching", "enriching")).toBe(false);
    expect(canTransition("planning", "searching")).toBe(true);
    expect(canTransition("qualifying", "completed")).toBe(true);
  });
  it("treats terminal states as non-transitioning", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(canTransition("completed", "planning")).toBe(false);
    expect(canTransition("cancelled", "planning")).toBe(false);
  });
  it("marks interrupted active runs resumable", () => {
    expect(isResumable("enriching")).toBe(true);
    expect(isResumable("paused")).toBe(true);
    expect(isResumable("completed")).toBe(false);
  });
});

describe("ssrf / url safety", () => {
  it("allows public http(s) urls", () => {
    expect(isPublicUrl("https://villa-mare.hr/kontakt")).toBe(true);
  });
  it("blocks private, loopback, link-local and metadata addresses", () => {
    expect(isPublicUrl("http://localhost:3000")).toBe(false);
    expect(isPublicUrl("http://127.0.0.1")).toBe(false);
    expect(isPublicUrl("http://10.0.0.5")).toBe(false);
    expect(isPublicUrl("http://192.168.1.1")).toBe(false);
    expect(isPublicUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isPublicUrl("http://172.16.0.1")).toBe(false);
  });
  it("blocks non-http protocols", () => {
    expect(validatePublicUrl("file:///etc/passwd").ok).toBe(false);
    expect(validatePublicUrl("ftp://x.com").ok).toBe(false);
  });
  it("refuses to scrape social/marketplace domains", () => {
    expect(isScrapableDomain("https://www.facebook.com/villa")).toBe(false);
    expect(isScrapableDomain("https://www.booking.com/hotel/hr/villa")).toBe(false);
    expect(isScrapableDomain("https://villa-mare.hr")).toBe(true);
  });
});

describe("gemini structured-result validation", () => {
  it("rejects malformed model output", () => {
    expect(() =>
      leadAnalysisSchema.parse({ businessName: "x" }),
    ).toThrow();
  });
  it("accepts a valid analysis", () => {
    expect(() => baseAnalysis()).not.toThrow();
  });
});
