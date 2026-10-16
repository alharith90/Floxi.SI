import { Client, escapeIdentifier } from "pg";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, chmod } from "node:fs/promises";
import { Db, config } from "../apps/api/src/db";
import { json } from "../apps/api/src/json";
import { tick } from "../apps/api/src/execution/engine";
import type { Graph } from "@floxi/shared";
process.umask(0o077);
const db = new Db(),
  admin = new Client({ connectionString: config.DATABASE_URL });
await admin.connect();
const suffix = randomUUID().replaceAll("-", ""),
  destination = `floxi_restore_${suffix}`,
  workspaceId = randomUUID(),
  workflowId = randomUUID(),
  trigger = randomUUID(),
  response = randomUUID(),
  runId = randomUUID();
const backup = `/workspace/backups/floxi-readiness-${suffix}.dump`,
  bin = "/workspace/.postgres/root/usr/lib/postgresql/17/bin";
let created = false,
  fixture = false;
try {
  const graph: Graph = {
    schemaVersion: 1,
    nodes: [
      {
        id: trigger,
        type: "manual",
        typeVersion: 1,
        label: "Backup verification trigger",
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: response,
        type: "response",
        typeVersion: 1,
        label: "Backup verification response",
        position: { x: 300, y: 0 },
        parameters: { body: { restoreMarker: suffix } },
      },
    ],
    edges: [
      {
        id: randomUUID(),
        source: trigger,
        target: response,
        sourcePort: "output",
        targetPort: "input",
      },
    ],
  };
  await db.workspace.create({
    data: { id: workspaceId, name: "Temporary backup verification" },
  });
  fixture = true;
  await db.workflow.create({
    data: {
      id: workflowId,
      workspaceId,
      name: "Temporary backup verification",
      graph: json(graph),
      publishedVersion: 1,
    },
  });
  await db.version.create({
    data: { workflowId, number: 1, graph: json(graph) },
  });
  await db.run.create({
    data: { id: runId, workflowId, version: 1, graph: json(graph), input: {} },
  });
  for (let attempt = 0; attempt < 10; attempt++) {
    await tick(db);
    if (
      (await db.run.findUniqueOrThrow({ where: { id: runId } })).status ===
      "SUCCEEDED"
    )
      break;
  }
  if (
    (await db.run.findUniqueOrThrow({ where: { id: runId } })).status !==
    "SUCCEEDED"
  )
    throw new Error("Backup fixture execution did not complete.");
  await mkdir("/workspace/backups", { recursive: true });
  await promisify(execFile)(`${bin}/pg_dump`, [
    "-h",
    "/workspace/.postgres/socket",
    "-U",
    "agent",
    "-d",
    "floxi.si",
    "-Fc",
    "-f",
    backup,
  ]);
  await chmod(backup, 0o600);
  await admin.query(`CREATE DATABASE ${escapeIdentifier(destination)}`);
  created = true;
  await promisify(execFile)(`${bin}/pg_restore`, [
    "-h",
    "/workspace/.postgres/socket",
    "-U",
    "agent",
    "-d",
    destination,
    "--exit-on-error",
    backup,
  ]);
  const url = new URL(config.DATABASE_URL);
  url.pathname = `/${destination}`;
  const restored = new Client({ connectionString: url.toString() });
  await restored.connect();
  try {
    const checkpoint = await restored.query<{
      output: { restoreMarker: string };
    }>('SELECT output FROM "Step" WHERE "runId"=$1 AND "nodeId"=$2', [
      runId,
      response,
    ]);
    if (checkpoint.rows[0]?.output.restoreMarker !== suffix)
      throw new Error("Restored execution checkpoint does not match.");
    const vector = await restored.query<{ extversion: string }>(
      "SELECT extversion FROM pg_extension WHERE extname='vector'",
    );
    if (vector.rows[0]?.extversion !== "0.8.0")
      throw new Error("Restored vector extension is missing.");
    const migrations = await restored.query(
        'SELECT name, checksum FROM "_floxi_migrations" ORDER BY name',
      ),
      sourceMigrations = await admin.query(
        'SELECT name, checksum FROM "_floxi_migrations" ORDER BY name',
      );
    if (
      JSON.stringify(migrations.rows) !== JSON.stringify(sourceMigrations.rows)
    )
      throw new Error("Restored migration checksums mismatch.");
    console.log(
      "Backup/restore passed: actual execution output, pgvector 0.8.0, and both migration checksums preserved in a separate temporary database.",
    );
  } finally {
    await restored.end();
  }
} finally {
  if (created)
    await admin.query(`DROP DATABASE ${escapeIdentifier(destination)}`);
  if (fixture) {
    await db.runEvent.deleteMany({ where: { runId } });
    await db.step.deleteMany({ where: { runId } });
    await db.run.deleteMany({ where: { id: runId } });
    await db.version.deleteMany({ where: { workflowId } });
    await db.workflow.deleteMany({ where: { id: workflowId } });
    await db.workspace.delete({ where: { id: workspaceId } });
  }
  await admin.end();
  await db.$disconnect();
}
