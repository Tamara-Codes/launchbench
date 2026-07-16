import { describe, expect, it } from "vitest";
import { buildContentPlan } from "./content-plan";

const mastograd = {
  id: "mastograd", name: "Maštograd", postingPriority: 60, directSalesFrequency: 1,
  pillars: [{ name: "Product discovery", purpose: "Show the product", examples: ["Personalized alphabet"] }, { name: "Personalization", purpose: "Show the name", examples: ["A child’s name on the page"] }],
  exampleIdeas: ["Kako izgleda proizvod kada na njemu piše baš ime djeteta?"], recentHooks: [],
};
const guide = {
  id: "guide", name: "Digital Guest Welcome Book", postingPriority: 40, directSalesFrequency: 1,
  pillars: [{ name: "Common host problems", purpose: "Show a hosting problem", examples: ["Wi-Fi password"] }, { name: "Product demonstration", purpose: "Show verified flow", examples: ["Scan the QR code"] }],
  exampleIdeas: ["Koliko puta si ovog ljeta poslao istu Wi-Fi lozinku?"], recentHooks: [],
};

describe("buildContentPlan", () => {
  it("creates a product-aware two-day plan without consecutive product repeats", () => {
    const plan = buildContentPlan([mastograd, guide], new Date("2026-07-16T10:00:00Z"));
    expect(plan).toHaveLength(7);
    expect(plan.map((item) => item.productId)).toContain("mastograd");
    expect(plan.map((item) => item.productId)).toContain("guide");
    for (let index = 1; index < plan.length; index++) expect(plan[index]!.productId).not.toBe(plan[index - 1]!.productId);
    expect(plan[1]!.scheduledFor.getTime() - plan[0]!.scheduledFor.getTime()).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("warns rather than silently reusing a recent hook", () => {
    const plan = buildContentPlan([{ ...mastograd, exampleIdeas: ["Repeated"], recentHooks: ["Repeated"], pillars: [{ name: "Product discovery", purpose: "Show the product", examples: ["Repeated"] }] }], new Date("2026-07-16T10:00:00Z"), 2);
    expect(plan[0]!.warnings.join(" ")).toMatch(/resembles recent content/i);
  });
});
