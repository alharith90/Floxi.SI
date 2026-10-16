import "dotenv/config";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
// Prisma 6's experimental WASM deploy adapter cannot deserialize PostgreSQL's
// pg_catalog.name type. Apply the reviewed, Prisma-generated SQL transactionally
// with an independent checksum ledger; never mark Prisma migrations as applied.
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(825902)");
  await client.query(
    'CREATE TABLE IF NOT EXISTS "_floxi_migrations" (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const root = resolve("apps/api/prisma/migrations");
  for (const folder of (await readdir(root, { withFileTypes: true }))
    .filter((f) => f.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const sql = await readFile(
      resolve(root, folder.name, "migration.sql"),
      "utf8",
    );
    if (!sql.trim()) throw new Error(`Migration ${folder.name} is empty.`);
    const checksum = createHash("sha256").update(sql).digest("hex");
    const found = await client.query<{ checksum: string }>(
      'SELECT checksum FROM "_floxi_migrations" WHERE name=$1',
      [folder.name],
    );
    if (found.rows.length) {
      if (found.rows[0].checksum !== checksum)
        throw new Error(`Applied migration ${folder.name} was modified.`);
      continue;
    }
    await client.query(sql);
    await client.query(
      'INSERT INTO "_floxi_migrations" (name,checksum) VALUES ($1,$2)',
      [folder.name, checksum],
    );
    console.log(`Applied ${folder.name}`);
  }
  await client.query("COMMIT");
  console.log("Database migrations are current.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
