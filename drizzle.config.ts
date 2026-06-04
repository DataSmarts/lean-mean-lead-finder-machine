import { config as loadDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// DATABASE_URL_UNPOOLED (direct TCP) is required here.
// PgBouncer (pooled) breaks multi-statement DDL — see ARCHITECTURE.md §11.
//
// drizzle-kit does not auto-load .env.local, so we load it explicitly here.
// In CI the variable is injected directly into the environment instead.
loadDotenv({ path: ".env.local", override: false });

const url = process.env["DATABASE_URL_UNPOOLED"];
if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED is not set. Add it to your .env.local file (local dev) " +
      "or inject it in the CI environment.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  // Point to the barrel index so drizzle-kit doesn't pick up *.test.ts files in the directory.
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
