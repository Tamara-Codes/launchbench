import "server-only";
import { createConnection, type Conn } from "./connect";
import * as schema from "./schema";

/**
 * A single SQLite connection reused across Next.js hot reloads. Without the
 * global cache, every reload would open a new better-sqlite3 handle and leak
 * file locks. The `server-only` import guarantees this module never ends up in
 * a client bundle (which would leak the database path / native module).
 */
const globalForDb = globalThis as unknown as { __nosAstraDb?: Conn };

const conn: Conn = globalForDb.__nosAstraDb ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__nosAstraDb = conn;
}

export const db = conn.db;
export const sqlite = conn.sqlite;
export const dbFilePath = conn.dbPath;
export { schema };
