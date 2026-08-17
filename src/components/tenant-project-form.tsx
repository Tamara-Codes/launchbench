"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Palette, Search } from "lucide-react";
import { Button, Input, Label } from "./ui";
import { ContextPanel, Area } from "./context-panel";
import { createTenantProject, updateTenantProject } from "@/server/tenant-actions";

type Context = "basics" | "sales" | "content";

type Project = {
  id?: string;
  name: string;
  full_description: string;
  target_customer: string;
  core_benefit: string;
  website_url: string;
  preferred_language: string;
  email_generation_context: string;
  sender_gender: "female" | "male";
  sender_signature: string;
  lead_search_plan?: { textQueries?: string[]; countries?: string[] };
  exclusions: string;
  brand_voice: string;
  social_media_notes: string;
  visual_style: string;
  preferred_cta: string;
  content_dos: string;
  content_donts: string;
};

const empty: Project = {
  name: "",
  full_description: "",
  target_customer: "",
  core_benefit: "",
  website_url: "",
  preferred_language: "hr",
  email_generation_context: "",
  sender_gender: "female",
  sender_signature: "",
  lead_search_plan: { textQueries: [], countries: [] },
  exclusions: "",
  brand_voice: "",
  social_media_notes: "",
  visual_style: "",
  preferred_cta: "",
  content_dos: "",
  content_donts: "",
};

export function TenantProjectForm({
  project,
  salesAgentName = "Sally",
  contentAgentName = "Contessa",
  initialContext = "basics",
}: {
  project?: Project;
  salesAgentName?: string;
  contentAgentName?: string;
  initialContext?: Context;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Project>(
    project
      ? {
          ...empty,
          ...project,
          exclusions: Array.isArray(project.exclusions)
            ? project.exclusions.join("\n")
            : project.exclusions,
        }
      : empty,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeContext = initialContext;
  const set = (key: keyof Project, value: string) => {
    setJustSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const [newTerm, setNewTerm] = useState("");
  const searchTerms = form.lead_search_plan?.textQueries ?? [];
  const setSearchTerms = (terms: string[]) => {
    setJustSaved(false);
    setForm((current) => ({ ...current, lead_search_plan: { ...current.lead_search_plan, textQueries: terms } }));
  };
  const addSearchTerm = () => {
    const term = newTerm.trim();
    if (!term || searchTerms.includes(term)) return;
    setSearchTerms([...searchTerms, term]);
    setNewTerm("");
  };
  const removeSearchTerm = (term: string) => setSearchTerms(searchTerms.filter((item) => item !== term));

  useEffect(() => () => clearTimeout(savedTimeout.current), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setJustSaved(false);
    const payload = {
      name: form.name,
      fullDescription: form.full_description,
      targetCustomer: form.target_customer,
      coreBenefit: form.core_benefit,
      websiteUrl: form.website_url,
      preferredLanguage: form.preferred_language,
      emailGenerationContext: form.email_generation_context,
      senderGender: form.sender_gender,
      senderSignature: form.sender_signature,
      excludedBusinessTypes: form.exclusions,
      searchTerms,
      brandVoice: form.brand_voice,
      socialMediaNotes: form.social_media_notes,
      visualStyle: form.visual_style,
      preferredCta: form.preferred_cta,
      contentDos: form.content_dos,
      contentDonts: form.content_donts,
    };
    const result = project?.id
      ? await updateTenantProject(project.id, payload)
      : await createTenantProject(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setJustSaved(true);
    clearTimeout(savedTimeout.current);
    savedTimeout.current = setTimeout(() => setJustSaved(false), 2500);

    const projectId = project?.id ?? result.data?.id;
    const suffix =
      activeContext === "sales" ? "?tab=sally" : activeContext === "content" ? "?tab=contessa" : "";
    router.push(`/app/projects/${projectId}${suffix}`);
    router.refresh();
  }

  const saveLabel =
    activeContext === "sales"
      ? `Save ${salesAgentName} context`
      : activeContext === "content"
        ? `Save ${contentAgentName} context`
        : project
          ? "Save project basics"
          : "Create project";

  return (
    <form onSubmit={submit} className="space-y-6">
      {activeContext === "basics" && (
        <section className="space-y-5">
          <Field
            label="Project name"
            value={form.name}
            onChange={(value) => set("name", value)}
            required
          />
          <Area
            label="What is it?"
            value={form.full_description}
            onChange={(value) => set("full_description", value)}
            rows={4}
            required
            hint="Describe the project, what it includes, and how it works."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Area
              label="Who is it for?"
              value={form.target_customer}
              onChange={(value) => set("target_customer", value)}
              rows={3}
              required
            />
            <Area
              label="Main benefit"
              value={form.core_benefit}
              onChange={(value) => set("core_benefit", value)}
              rows={3}
              required
            />
          </div>
          <Field
            label="Website"
            value={form.website_url}
            onChange={(value) => set("website_url", value)}
            placeholder="https://…"
            type="url"
          />
        </section>
      )}

      {activeContext === "sales" && (
        <section className="space-y-5">
          <ContextPanel icon={Search} title="Lead discovery" tone="sales">
            <div className="space-y-1.5">
              <Label>Search terms</Label>
              {searchTerms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {searchTerms.map((query) => (
                    <span key={query} className="flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-accent">
                      {query}
                      <button
                        type="button"
                        onClick={() => removeSearchTerm(query)}
                        aria-label={`Remove ${query}`}
                        className="rounded-full px-1 text-accent/70 hover:text-accent"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">Save the project to generate search terms.</p>
              )}
              <div className="flex gap-1.5">
                <Input
                  value={newTerm}
                  onChange={(event) => setNewTerm(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSearchTerm(); } }}
                  placeholder="Add a search term"
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={addSearchTerm}>Add</Button>
              </div>
            </div>
            <Area
              label="Business types to exclude"
              value={form.exclusions}
              onChange={(value) => set("exclusions", value)}
              rows={3}
              hint="One per line. Matching candidates are rejected automatically."
              placeholder={"large hotel chains\ntravel agencies"}
            />
          </ContextPanel>
        </section>
      )}

      {activeContext === "content" && (
        <section className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <ContextPanel
              icon={MessageSquareText}
              title="Voice and message"
              description={`Define how ${contentAgentName} should sound and what the content should communicate.`}
              tone="content"
            >
              <Area
                label="Brand voice"
                value={form.brand_voice}
                onChange={(value) => set("brand_voice", value)}
                rows={3}
                placeholder="e.g. warm, direct, practical"
              />
              <Area
                label="Key messages"
                value={form.social_media_notes}
                onChange={(value) => set("social_media_notes", value)}
                rows={4}
                placeholder="Themes, facts, or angles to repeat"
              />
              <Area
                label="Preferred CTA"
                value={form.preferred_cta}
                onChange={(value) => set("preferred_cta", value)}
                rows={3}
                placeholder="e.g. Visit the website to learn more"
              />
            </ContextPanel>
            <ContextPanel
              icon={Palette}
              title="Creative guardrails"
              description="Set the visual direction and the boundaries every piece of content must follow."
              tone="content"
            >
              <Area
                label="Visual direction"
                value={form.visual_style}
                onChange={(value) => set("visual_style", value)}
                rows={3}
                placeholder="Describe the look and feel for generated images"
              />
              <Area
                label="Always do"
                value={form.content_dos}
                onChange={(value) => set("content_dos", value)}
                rows={3}
              />
              <Area
                label="Never do or claim"
                value={form.content_donts}
                onChange={(value) => set("content_donts", value)}
                rows={3}
              />
            </ContextPanel>
          </div>
        </section>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end border-t border-border pt-5">
        <Button disabled={busy}>{busy ? "Saving…" : justSaved ? "Saved!" : saveLabel}</Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
