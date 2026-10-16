import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Db } from "../apps/api/src/db";
import type { Graph, Run, Workflow } from "@floxi/shared";
const db = new Db(),
  userId = randomUUID(),
  workspaceId = randomUUID(),
  token = randomBytes(32).toString("hex");
let created = false;
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(`http://127.0.0.1:3002/api/${path}`, {
    method,
    headers: {
      Cookie: `floxi_session=${token}`,
      "Content-Type": "application/json",
      "X-Floxi-Request": "1",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`Built API returned HTTP ${r.status} for ${path}`);
  return r.json();
}
try {
  await db.user.create({
    data: {
      id: userId,
      email: `production-smoke-${userId}@example.test`,
      passwordHash: "test-fixture-not-a-login",
      memberships: {
        create: {
          role: "admin",
          workspace: {
            create: {
              id: workspaceId,
              name: "Temporary production artifact smoke",
            },
          },
        },
      },
    },
  });
  created = true;
  await db.session.create({
    data: {
      id: createHash("sha256").update(token).digest("hex"),
      userId,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const workflow = await request<Workflow>("workflows", "POST", {
      name: "Temporary production smoke",
      description: "Removed after artifact verification",
    }),
    trigger = randomUUID(),
    response = randomUUID();
  const graph: Graph = {
    schemaVersion: 1,
    nodes: [
      {
        id: trigger,
        type: "manual",
        typeVersion: 1,
        label: "Start",
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: response,
        type: "response",
        typeVersion: 1,
        label: "Result",
        position: { x: 300, y: 0 },
        parameters: { body: { result: "production-artifact-verified" } },
      },
    ],
    edges: [
      {
        id: randomUUID(),
        source: trigger,
        sourcePort: "output",
        target: response,
        targetPort: "input",
      },
    ],
  };
  const saved = await request<Workflow>(
    `workflows/${workflow.id}/draft`,
    "PATCH",
    {
      name: workflow.name,
      description: workflow.description,
      revision: workflow.revision,
      graph,
    },
  );
  await request(`workflows/${workflow.id}/publish`, "POST", {
    revision: saved.revision,
  });
  const run = await request<Run>(`workflows/${workflow.id}/runs`, "POST", {
    input: {},
    idempotencyKey: randomUUID(),
  });
  let result: Run | undefined;
  for (let attempt = 0; attempt < 80; attempt++) {
    result = await request<Run>(`executions/${run.id}`);
    if (["SUCCEEDED", "FAILED"].includes(result.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (
    result?.status !== "SUCCEEDED" ||
    result.steps.find((s) => s.nodeId === response)?.output.result !==
      "production-artifact-verified"
  )
    throw new Error(
      "Built API/worker did not produce the expected persisted response.",
    );
  await request("operations/health");
  console.log(
    "Production artifacts passed: authenticated create, save, publish, queued worker execution, stored response, and dependency health.",
  );
} finally {
  if (created) {
    const workflows = await db.workflow.findMany({
        where: { workspaceId },
        select: { id: true },
      }),
      ids = workflows.map((w) => w.id),
      runs = await db.run.findMany({
        where: { workflowId: { in: ids } },
        select: { id: true },
      }),
      rids = runs.map((r) => r.id);
    await db.runEvent.deleteMany({ where: { runId: { in: rids } } });
    await db.step.deleteMany({ where: { runId: { in: rids } } });
    await db.run.deleteMany({ where: { id: { in: rids } } });
    await db.version.deleteMany({ where: { workflowId: { in: ids } } });
    await db.workflow.deleteMany({ where: { id: { in: ids } } });
    await db.audit.deleteMany({ where: { workspaceId } });
    await db.user.delete({ where: { id: userId } });
    await db.workspace.delete({ where: { id: workspaceId } });
  }
  await db.$disconnect();
}
