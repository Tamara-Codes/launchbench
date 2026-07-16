import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "./data/sales-agent.db";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: { url },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
