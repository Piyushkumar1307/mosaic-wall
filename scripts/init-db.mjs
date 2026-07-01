import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Copy .env.example to .env and set your Neon connection string.");
  process.exit(1);
}

const sql = neon(url);

const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log("Database initialized successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
