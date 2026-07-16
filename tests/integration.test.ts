import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { desc, eq } from "drizzle-orm";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

// Point the DB at a throwaway file BEFORE importing the connection factory.
const TEST_DB = resolve(
  process.cwd(),
  "data",
  `test-${process.pid}-${Math.floor(performance.now())}.db`,
);
process.env.DATABASE_URL = TEST_DB;

const { createConnection } = await import("@/db/connect");
const schema = await import("@/db/schema");

const { db, sqlite } = createConnection();

beforeAll(() => {
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
});

afterAll(() => {
  sqlite.close();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const f = `${TEST_DB}${suffix}`;
    if (existsSync(f)) rmSync(f);
  }
});

describe("prompt-version create & restore", () => {
  it("increments versions and can restore an older one", async () => {
    const [agent] = await db
      .insert(schema.agents)
      .values({
        name: "Test Agent",
        slug: `test-${Math.floor(performance.now())}`,
        agentType: "lead_finder",
        systemPrompt: "v1 system",
        taskPromptTemplate: "v1 task",
      })
      .returning();

    // Save v1..v3 the way the action does (max+1).
    async function saveVersion(system: string, task: string, note: string) {
      const [latest] = await db
        .select({ v: schema.agentPromptVersions.version })
        .from(schema.agentPromptVersions)
        .where(eq(schema.agentPromptVersions.agentId, agent!.id))
        .orderBy(desc(schema.agentPromptVersions.version))
        .limit(1);
      const next = (latest?.v ?? 0) + 1;
      await db.insert(schema.agentPromptVersions).values({
        agentId: agent!.id,
        version: next,
        systemPrompt: system,
        taskPromptTemplate: task,
        model: "gemini-2.5-flash",
        temperature: 0.2,
        maxOutputTokens: 2048,
        note,
      });
      await db.update(schema.agents).set({ systemPrompt: system, taskPromptTemplate: task }).where(eq(schema.agents.id, agent!.id));
      return next;
    }

    expect(await saveVersion("v1 system", "v1 task", "v1")).toBe(1);
    expect(await saveVersion("v2 system", "v2 task", "v2")).toBe(2);

    // Restore v1 -> creates v3 carrying v1 content.
    const [v1] = await db
      .select()
      .from(schema.agentPromptVersions)
      .where(eq(schema.agentPromptVersions.version, 1));
    const restored = await saveVersion(v1!.systemPrompt, v1!.taskPromptTemplate, "restore v1");
    expect(restored).toBe(3);

    const [current] = await db.select().from(schema.agents).where(eq(schema.agents.id, agent!.id));
    expect(current!.systemPrompt).toBe("v1 system");

    const versions = await db
      .select()
      .from(schema.agentPromptVersions)
      .where(eq(schema.agentPromptVersions.agentId, agent!.id));
    expect(versions).toHaveLength(3);
  });
});

describe("email-send idempotency", () => {
  it("rejects a second send with the same sendKey (unique constraint)", async () => {
    const [territory] = await db
      .insert(schema.territories)
      .values({ town: `T${Math.floor(performance.now())}`, country: "Croatia" })
      .returning();
    const [lead] = await db
      .insert(schema.leads)
      .values({
        territoryId: territory!.id,
        businessName: "Idem Villa",
        email: "info@idem.hr",
        normalizedEmail: "info@idem.hr",
        status: "approved",
        facts: {
          verifiedFacts: [],
          inferredFacts: [],
          unknownFields: [],
          qualificationReasons: [],
          rejectionReasons: [],
          languages: [],
        },
      })
      .returning();

    const sendKey = `${lead!.id}:initial:once`;

    await db.insert(schema.sentEmails).values({
      leadId: lead!.id,
      emailType: "initial",
      recipientEmail: "info@idem.hr",
      subject: "Hi",
      body: "Hello",
      sendKey,
    });

    // The idempotency guard: a duplicate sendKey must not be inserted twice.
    const existing = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.sendKey, sendKey));
    expect(existing).toHaveLength(1);

    // A raw duplicate insert must throw on the unique index.
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO sent_emails (id, lead_id, email_type, recipient_email, subject, body, gmail_message_id, gmail_thread_id, provider, send_key, sent_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          "dup",
          lead!.id,
          "initial",
          "info@idem.hr",
          "Hi",
          "Hello",
          "",
          "",
          "composio_gmail",
          sendKey,
          Date.now(),
          Date.now(),
        ),
    ).toThrow();
  });
});
