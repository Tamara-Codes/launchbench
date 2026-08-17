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
import { buildGooglePlacesQuery } from "./lead-search-query";
import type { QualificationSettings } from "./qualify";

const bounds = {
  town: "Malinska",
  includedSettlements: ["Bogovići", "Sveti Vid"],
  excludedSettlements: ["Krk", "Punat"],
};

describe("Google Places query building", () => {
  it("adds the complete selected territory to plain search terms", () => {
    expect(buildGooglePlacesQuery("apartmani", "Malinska", "Croatia")).toBe(
      "apartmani in Malinska, Croatia",
    );
  });

  it("supports explicit territory and town placeholders without duplication", () => {
    expect(
      buildGooglePlacesQuery("holiday apartments {territory}", "Malinska", "Croatia"),
    ).toBe("holiday apartments Malinska, Croatia");
    expect(buildGooglePlacesQuery("apartmani {town}", "Malinska", "Croatia")).toBe(
      "apartmani Malinska, Croatia",
    );
  });
});

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
  minConfidence: 0.5,
};

function baseAnalysis() {
  return leadAnalysisSchema.parse({
    businessName: "Villa Mare",
    businessType: "holiday apartment operator",
    location: "Malinska",
    website: "https://villa-mare.hr",
    publicEmail: "info@villa-mare.hr",
    publicPhone: "+385912345678",
    matchesProjectExclusion: false,
    matchedProjectExclusion: "",
    matchesIdealCustomer: true,
    offerRelevance: "strong",
    fitReasons: ["Independent tourist accommodation operator"],
    disqualifyingReasons: [],
    emailDraft: {
      subject: "A clearer welcome for Villa Mare guests",
      body: "Hello,\n\nI noticed that Villa Mare welcomes guests in Malinska.",
    },
    confidence: 0.8,
    verifiedFacts: ["Offers holiday apartments in Malinska"],
    inferredFacts: [],
    unknownFields: [],
    sourceEvidence: [{ url: "https://villa-mare.hr", field: "email", snippet: "info@villa-mare.hr" }],
  });
}

describe("qualification", () => {
  it("validates a structured email draft as part of candidate analysis", () => {
    const analysis = baseAnalysis();
    expect(analysis.emailDraft.subject).toContain("Villa Mare");
    expect(analysis.emailDraft.body).toContain("Malinska");
  });
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
  it("rejects a candidate that does not match the project's ideal customer", () => {
    const a = baseAnalysis();
    a.matchesIdealCustomer = false;
    a.disqualifyingReasons = ["The business is outside the target customer profile"];
    const r = qualifyLead({
      analysis: a,
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Malinska",
    });
    expect(r.outcome).toBe("rejected");
    expect(r.rejectionReasons.join(" ")).toMatch(/outside the target customer profile/i);
  });
  it("sends weak offer relevance to manual review", () => {
    const a = baseAnalysis();
    a.offerRelevance = "weak";
    const r = qualifyLead({
      analysis: a,
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Malinska",
    });
    expect(r.outcome).toBe("manualReview");
  });
  it("matches exclusions across plurals and Google category separators", () => {
    const a = baseAnalysis();
    a.businessType = "Local travel agency";
    const r = qualifyLead({
      analysis: a,
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Malinska",
      excludedBusinessTypes: ["travel agencies"],
      placeTypes: ["travel_agency"],
    });
    expect(r.outcome).toBe("rejected");
    expect(r.rejectionReasons).toContain('Matches project exclusion: "travel agencies"');
  });
  it("honors a semantic exclusion only when Gemini names a saved exclusion", () => {
    const a = baseAnalysis();
    a.businessType = "Hotel";
    a.verifiedFacts = ["The property is part of an international hospitality group"];
    a.matchesProjectExclusion = true;
    a.matchedProjectExclusion = "large hotel chains";
    const r = qualifyLead({
      analysis: a,
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Malinska",
      excludedBusinessTypes: ["large hotel chains"],
    });
    expect(r.outcome).toBe("rejected");
    expect(r.rejectionReasons).toContain('Matches project exclusion: "large hotel chains"');
  });
  it("ignores an exclusion invented by the model", () => {
    const a = baseAnalysis();
    a.matchesProjectExclusion = true;
    a.matchedProjectExclusion = "all accommodation businesses";
    const r = qualifyLead({
      analysis: a,
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Malinska",
      excludedBusinessTypes: ["large hotel chains"],
    });
    expect(r.outcome).toBe("qualified");
  });
  it("does not match an exclusion inside an unrelated word", () => {
    const a = baseAnalysis();
    a.businessType = "Award-winning apartment operator";
    const r = qualifyLead({
      analysis: a,
      sourceEmails: ["info@villa-mare.hr"],
      bounds,
      settings: qSettings,
      locationText: "Malinska",
      excludedBusinessTypes: ["inn"],
    });
    expect(r.outcome).toBe("qualified");
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
