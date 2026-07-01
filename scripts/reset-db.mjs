import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Copy .env.example to .env and set your Neon connection string.");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql.query("TRUNCATE TABLE messages RESTART IDENTITY");
  console.log("All messages removed. Sequence reset.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
