import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io } from "socket.io-client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { scryptSync } from "node:crypto";
import { Db } from "../apps/api/src/db";
import { json, WorkflowsService } from "../apps/api/src/workflows/workflows";
import { tick } from "../apps/api/src/execution/engine";
import type { Actor } from "../apps/api/src/auth/auth";
import { chain, node, reference } from "./fixtures";
import type { Graph } from "@floxi/shared";
const db = new Db(),
  service = new WorkflowsService(db);
const ids = {
  user: randomUUID(),
  workspace: randomUUID(),
  foreign: randomUUID(),
};
const token = randomBytes(32).toString("hex");
const testPassword = randomBytes(24).toString("hex"),
  salt = randomBytes(16).toString("hex");
let actor: Actor;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = token,
) {
  return fetch(`http://127.0.0.1:3001/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Floxi-Request": "1",
      Cookie: `floxi_session=${cookie}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function flow(graph: Graph) {
  const created = await service.create(actor, {
    name: "Integration test",
    description: "Temporary test fixture",
  });
  const saved = await service.save(actor, created.id, {
    name: created.name,
    description: "",
    revision: created.revision,
    graph,
  });
  return service.publish(actor, saved.id, saved.revision);
}
async function createRun(graph: Graph) {
  const w = await flow(graph);
  return db.run.create({
    data: {
      workflowId: w.id,
      version: w.publishedVersion!,
      graph: json(graph),
      input: { name: "Ada" },
    },
  });
}
async function finish(id: string) {
  for (let i = 0; i < 25; i++) {
    await tick(db);
    const r = await db.run.findUniqueOrThrow({
      where: { id },
      include: { steps: true },
    });
    if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(r.status)) return r;
  }
  throw new Error("Execution did not finish.");
}
beforeAll(async () => {
  await db.$connect();
  await db.workspace.createMany({
    data: [
      { id: ids.workspace, name: "Temporary integration workspace" },
      { id: ids.foreign, name: "Foreign test workspace" },
    ],
  });
  await db.user.create({
    data: {
      id: ids.user,
      email: `test-${ids.user}@example.test`,
      passwordHash: `${salt}:${scryptSync(testPassword, salt, 64).toString("hex")}`,
      memberships: { create: { workspaceId: ids.workspace, role: "admin" } },
    },
  });
  await db.session.create({
    data: {
      id: createHash("sha256").update(token).digest("hex"),
      userId: ids.user,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  actor = {
    userId: ids.user,
    workspaceId: ids.workspace,
    role: "admin",
    email: "temporary",
  };
});
afterAll(async () => {
  const workflows = await db.workflow.findMany({
      where: { workspaceId: { in: [ids.workspace, ids.foreign] } },
      select: { id: true },
    }),
    ws = workflows.map((w) => w.id);
  const runs = await db.run.findMany({
      where: { workflowId: { in: ws } },
      select: { id: true },
    }),
    rs = runs.map((r) => r.id);
  await db.runEvent.deleteMany({ where: { runId: { in: rs } } });
  await db.step.deleteMany({ where: { runId: { in: rs } } });
  await db.run.deleteMany({ where: { id: { in: rs } } });
  await db.version.deleteMany({ where: { workflowId: { in: ws } } });
  await db.workflow.deleteMany({ where: { id: { in: ws } } });
  await db.audit.deleteMany({
    where: { workspaceId: { in: [ids.workspace, ids.foreign] } },
  });
  await db.user.delete({ where: { id: ids.user } });
  await db.workspace.deleteMany({
    where: { id: { in: [ids.workspace, ids.foreign] } },
  });
  await db.$disconnect();
});
describe("API persistence and isolation", () => {
  it("serves a resolvable OpenAPI contract for graph and execution requests", async () => {
    const response = await fetch("http://127.0.0.1:3001/api/docs-json");
    expect(response.status).toBe(200);
    const doc = await response.json();
    expect(
      doc.paths["/api/workflows/{id}/draft"].patch.requestBody,
    ).toBeTruthy();
    function check(value: unknown) {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (
          key === "$ref" &&
          typeof child === "string" &&
          child.startsWith("#/")
        ) {
          let target: unknown = doc;
          for (const segment of child.slice(2).split("/"))
            target =
              target && typeof target === "object"
                ? (target as Record<string, unknown>)[segment]
                : undefined;
          expect(target, `Unresolved OpenAPI reference ${child}`).toBeTruthy();
        } else check(child);
      }
    }
    check(doc);
  });

  it("rejects unauthenticated realtime connections", async () => {
    const socket = io("http://127.0.0.1:3001", {
      transports: ["websocket"],
      extraHeaders: { Cookie: "floxi_session=invalid" },
      reconnection: false,
    });
    try {
      const message = await new Promise<string>((resolve, reject) => {
        const t = setTimeout(
          () => reject(new Error("No socket rejection")),
          3000,
        );
        socket.on("connect_error", (e) => {
          clearTimeout(t);
          resolve(e.message);
        });
      });
      expect(message).toContain("Sign in");
    } finally {
      socket.disconnect();
    }
  });
  it("replays only persisted realtime events after a supplied cursor", async () => {
    const r = await createRun(
      chain(node("manual"), node("response", { body: { ok: true } })),
    );
    await finish(r.id);
    const events = await db.runEvent.findMany({
        where: { runId: r.id },
        orderBy: { sequence: "asc" },
      }),
      after = events[0].sequence;
    const socket = io("http://127.0.0.1:3001", {
      transports: ["websocket"],
      extraHeaders: { Cookie: `floxi_session=${token}` },
      reconnection: false,
    });
    try {
      const received = await new Promise<{ sequence: number; runId: string }>(
        (resolve, reject) => {
          const t = setTimeout(
            () => reject(new Error("No replayed event")),
            4000,
          );
          socket.on("connect", () =>
            socket.emit("subscribe", { runId: r.id, after }),
          );
          socket.on("execution.event", (event) => {
            clearTimeout(t);
            resolve(event);
          });
          socket.on("connect_error", reject);
        },
      );
      expect(received.runId).toBe(r.id);
      expect(received.sequence).toBeGreaterThan(after);
    } finally {
      socket.disconnect();
    }
  });

  it("authenticates, revokes sessions, and refuses bootstrap takeover", async () => {
    const login = await request("auth/login", "POST", {
      email: `test-${ids.user}@example.test`,
      password: testPassword,
    });
    expect(login.status).toBe(201);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const me = await fetch("http://127.0.0.1:3001/api/auth/me", {
      headers: { Cookie: cookie },
    });
    expect(me.status).toBe(200);
    const logout = await fetch("http://127.0.0.1:3001/api/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie, "X-Floxi-Request": "1" },
    });
    expect(logout.status).toBe(201);
    expect(
      (
        await fetch("http://127.0.0.1:3001/api/auth/me", {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("auth/setup", "POST", {
          email: "takeover@example.test",
          password: testPassword,
        })
      ).status,
    ).toBe(409);
  });
  it("deduplicates concurrent requests with the same workflow idempotency key", async () => {
    const w = await flow(
      chain(node("manual"), node("response", { body: { ok: true } })),
    );
    const key = randomUUID();
    const responses = await Promise.all([
      request(`workflows/${w.id}/runs`, "POST", {
        input: {},
        idempotencyKey: key,
      }),
      request(`workflows/${w.id}/runs`, "POST", {
        input: {},
        idempotencyKey: key,
      }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    const runs = await Promise.all(responses.map((r) => r.json()));
    expect(runs[0].id).toBe(runs[1].id);
    await finish(runs[0].id);
  });

  it("denies anonymous API reads", async () => {
    expect(
      (await request("studio/apps", "GET", undefined, "invalid")).status,
    ).toBe(401);
  });
  it("rejects missing CSRF request header and foreign Origin", async () => {
    expect(
      (
        await fetch("http://127.0.0.1:3001/api/workflows", {
          method: "POST",
          headers: {
            Cookie: `floxi_session=${token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch("http://127.0.0.1:3001/api/studio/apps", {
          headers: {
            Origin: "https://evil.example",
            Cookie: `floxi_session=${token}`,
          },
        })
      ).status,
    ).toBe(403);
  });
  it("persists creation and rejects stale saves", async () => {
    const r = await request("workflows", "POST", {
      name: "Persistent draft",
      description: "",
    });
    expect(r.status).toBe(201);
    const w = await r.json();
    expect((await request(`workflows/${w.id}`)).status).toBe(200);
    const body = {
      name: w.name,
      description: "",
      graph: w.graph,
      revision: w.revision,
    };
    expect(
      (await request(`workflows/${w.id}/draft`, "PATCH", body)).status,
    ).toBe(200);
    expect(
      (await request(`workflows/${w.id}/draft`, "PATCH", body)).status,
    ).toBe(409);
  });
  it("denies cross-workspace reads, writes, versions and runs", async () => {
    const w = await db.workflow.create({
      data: {
        workspaceId: ids.foreign,
        name: "Foreign",
        graph: { schemaVersion: 1, nodes: [], edges: [] },
      },
    });
    for (const path of [`workflows/${w.id}`, `workflows/${w.id}/versions`])
      expect((await request(path)).status).toBe(404);
    expect(
      (await request(`workflows/${w.id}/runs`, "POST", { input: {} })).status,
    ).toBe(404);
    expect(
      (
        await request(`workflows/${w.id}/draft`, "PATCH", {
          name: "Hijack",
          revision: 1,
          description: "",
          graph: w.graph,
        })
      ).status,
    ).toBe(404);
  });
  it("enforces viewer RBAC server-side", async () => {
    await db.membership.update({
      where: {
        userId_workspaceId: { userId: ids.user, workspaceId: ids.workspace },
      },
      data: { role: "viewer" },
    });
    expect(
      (await request("workflows", "POST", { name: "Denied", description: "" }))
        .status,
    ).toBe(403);
    await db.membership.update({
      where: {
        userId_workspaceId: { userId: ids.user, workspaceId: ids.workspace },
      },
      data: { role: "admin" },
    });
  });
  it("pins execution snapshots when a draft changes", async () => {
    const trigger = node("manual"),
      response = node("response", { body: { version: "one" } }),
      g = chain(trigger, response);
    const w = await flow(g);
    await service.save(actor, w.id, {
      name: w.name,
      description: "",
      revision: w.revision,
      graph: chain(trigger, {
        ...response,
        parameters: { body: { version: "two" } },
      }),
    });
    const r = await request(`workflows/${w.id}/runs`, "POST", { input: {} });
    expect(r.status).toBe(201);
    const run = await r.json();
    const result = await finish(run.id);
    expect(result.steps.find((s) => s.nodeId === response.id)?.output).toEqual({
      version: "one",
    });
    expect((await request(`executions/${run.id}/events?after=0`)).status).toBe(
      200,
    );
  });
});
describe("durable interpreter", () => {
  it("serializes concurrent step claims without duplicate checkpoints", async () => {
    const run = await createRun(
      chain(
        node("manual"),
        node("set", { fields: { ok: true } }),
        node("response"),
      ),
    );
    for (let i = 0; i < 5; i++)
      await Promise.all([tick(db), tick(db), tick(db)]);
    const result = await finish(run.id);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.steps.length).toBe(3);
    expect(new Set(result.steps.map((s) => s.nodeId)).size).toBe(3);
  });
  it("runs 100 persisted graphs with real mapped results", async () => {
    const start = node("manual"),
      set = node("set", { fields: { greeting: "hello" } }),
      end = node("response", {
        body: {
          name: reference(start, "name"),
          greeting: reference(set, "greeting"),
        },
      }),
      g = chain(start, set, end),
      w = await flow(g);
    const runIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const r = await db.run.create({
        data: {
          workflowId: w.id,
          version: 1,
          graph: json(g),
          input: { name: `User ${i}` },
        },
      });
      runIds.push(r.id);
    }
    for (const id of runIds) {
      const r = await finish(id);
      expect(r.status).toBe("SUCCEEDED");
      expect(r.steps.find((s) => s.nodeId === end.id)?.output).toHaveProperty(
        "greeting",
        "hello",
      );
    }
    expect(
      await db.run.count({
        where: { id: { in: runIds }, status: "SUCCEEDED" },
      }),
    ).toBe(100);
  }, 90000);
  it("persists mapping failures and node errors", async () => {
    const start = node("manual"),
      end = node("response", { body: { value: reference(start, "missing") } }),
      r = await createRun(chain(start, end));
    const result = await finish(r.id);
    expect(result.status).toBe("FAILED");
    expect(result.steps.find((s) => s.status === "FAILED")?.error).toContain(
      "unavailable",
    );
  });
  it("routes a false branch and skips its mutually exclusive path", async () => {
    const start = node("manual"),
      condition = node("condition", { left: 1, operator: "equals", right: 2 }),
      yes = node("response", { body: { branch: "yes" } }),
      no = node("response", { body: { branch: "no" } }),
      g = chain(start, condition, yes);
    g.nodes.push(no);
    g.edges.push({
      id: randomUUID(),
      source: condition.id,
      sourcePort: "false",
      target: no.id,
      targetPort: "input",
    });
    const r = await createRun(g),
      result = await finish(r.id);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.steps.find((s) => s.nodeId === yes.id)?.status).toBe(
      "SKIPPED",
    );
    expect(result.steps.find((s) => s.nodeId === no.id)?.output).toEqual({
      branch: "no",
    });
  });
  it("resumes a waiting checkpoint through a new database connection", async () => {
    const start = node("manual"),
      wait = node("wait", { seconds: 1 }),
      end = node("response", { body: { resumed: true } }),
      r = await createRun(chain(start, wait, end));
    for (let i = 0; i < 5; i++) {
      await tick(db);
      if (
        (await db.run.findUniqueOrThrow({ where: { id: r.id } })).status ===
        "WAITING"
      )
        break;
    }
    expect(
      (await db.run.findUniqueOrThrow({ where: { id: r.id } })).status,
    ).toBe("WAITING");
    const checkpoint = await db.step.findUniqueOrThrow({
      where: { runId_nodeId: { runId: r.id, nodeId: wait.id } },
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const replacement = new Db();
    try {
      for (let i = 0; i < 5; i++) await tick(replacement);
    } finally {
      await replacement.$disconnect();
    }
    const result = await finish(r.id);
    expect(result.status).toBe("SUCCEEDED");
    expect(
      (
        await db.step.findUniqueOrThrow({
          where: { runId_nodeId: { runId: r.id, nodeId: wait.id } },
        })
      ).id,
    ).toBe(checkpoint.id);
  });
  it("cancels durably and never resumes cancelled runs", async () => {
    const r = await createRun(
      chain(node("manual"), node("wait", { seconds: 10 }), node("response")),
    );
    expect((await request(`executions/${r.id}/cancel`, "POST")).status).toBe(
      201,
    );
    await tick(db);
    expect(
      (await db.run.findUniqueOrThrow({ where: { id: r.id } })).status,
    ).toBe("CANCELLED");
  });
});
