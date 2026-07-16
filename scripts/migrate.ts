import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createConnection } from "../src/db/connect";

const __dirname = dirname(fileURLToPath(import.meta.url));

function main() {
  const { db, sqlite, dbPath } = createConnection();
  const migrationsFolder = resolve(__dirname, "../drizzle");
  console.log(`Applying migrations from ${migrationsFolder}`);
  console.log(`Database: ${dbPath}`);
  migrate(db, { migrationsFolder });
  sqlite.close();
  console.log("✓ Migrations applied.");
}

main();
