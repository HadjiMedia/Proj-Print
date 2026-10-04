import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// This file is for Drizzle CLI commands only. An empty URL is not usable by
// drizzle-kit push, but it avoids throwing when build tooling imports modules.
// Set DATABASE_URL in the environment before running schema commands.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
