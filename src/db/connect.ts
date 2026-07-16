import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

/**
 * Connection factory shared by the Next.js app (src/db/index.ts) and the CLI
 * scripts (migrate/seed). No `server-only` guard here so it also runs under
 * plain Node / tsx. Configured for a local single-user SQLite database.
 */
export function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "./data/sales-agent.db";
  const cleaned = raw.replace(/^file:/, "");
  return resolve(process.cwd(), cleaned);
}

export function createConnection() {
  const dbPath = resolveDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  const db = drizzle(sqlite, { schema, casing: "snake_case" });
  return { sqlite, db, dbPath };
}

export type Conn = ReturnType<typeof createConnection>;
