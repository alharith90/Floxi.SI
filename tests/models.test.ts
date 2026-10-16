import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Db } from "../apps/api/src/db";
import { ModelsService } from "../apps/api/src/ai/models";
import {
  complete,
  embeddings,
  validateProviderUrl,
} from "../apps/api/src/ai/provider";
import type { Actor } from "../apps/api/src/auth/auth";
const db = new Db(),
  service = new ModelsService(db);
const workspaceId = randomUUID(),
  foreignId = randomUUID();
const actor: Actor = {
  workspaceId,
  userId: randomUUID(),
  role: "admin",
  email: "model-test@example.test",
};
let origin: string, endpointId: string;
let mode = "ok";
let requestBody: Record<string, unknown>;
const previous = process.env.MODEL_ALLOWED_ORIGINS;
const server = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (body) requestBody = JSON.parse(body);
  res.setHeader("Content-Type", "application/json");
  if (mode === "error") {
    res.writeHead(401);
    res.end('{"secret":"do not disclose"}');
    return;
  }
  if (mode === "invalid") {
    res.end("invalid JSON");
    return;
  }
  if (req.url === "/v1/models")
    res.end(JSON.stringify({ data: [{ id: "fixture-model" }] }));
  else if (req.url === "/v1/responses")
    res.end(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Responses fixture" }],
          },
        ],
        usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 },
      }),
    );
  else if (req.url === "/v1/embeddings")
    res.end(JSON.stringify({ data: [{ index: 0, embedding: [1, 2] }] }));
  else
    res.end(
      JSON.stringify({
        choices: [{ message: { content: "Chat fixture" } }],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      }),
    );
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  origin = `http://127.0.0.1:${address.port}`;
  process.env.MODEL_ALLOWED_ORIGINS = origin;
  await db.workspace.createMany({
    data: [
      { id: workspaceId, name: "Model tests" },
      { id: foreignId, name: "Foreign model tests" },
    ],
  });
});
afterAll(async () => {
  if (previous === undefined) delete process.env.MODEL_ALLOWED_ORIGINS;
  else process.env.MODEL_ALLOWED_ORIGINS = previous;
  await db.audit.deleteMany({ where: { workspaceId } });
  await db.modelEndpoint.deleteMany({ where: { workspaceId } });
  await db.workspace.deleteMany({
    where: { id: { in: [workspaceId, foreignId] } },
  });
  await db.$disconnect();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});
describe("workspace model registry and protocol adapters", () => {
  it("restricts configuration to administrators and rejects unapproved URLs", async () => {
    await expect(
      service.create({ ...actor, role: "editor" }, {}),
    ).rejects.toThrow("Only administrators");
    await expect(
      service.create(actor, {
        name: "Bad",
        baseUrl: "https://unapproved.example/v1",
        chatModel: "model",
      }),
    ).rejects.toThrow("not approved");
    expect(() => validateProviderUrl(`${origin}/v1?key=secret`)).toThrow(
      "without credentials",
    );
    expect(() => validateProviderUrl("http://169.254.169.254/v1")).toThrow(
      "Metadata",
    );
  });
  it("persists safe endpoint metadata with workspace isolation", async () => {
    const endpoint = await service.create(actor, {
      name: "Fixture",
      baseUrl: `${origin}/v1`,
      chatModel: "fixture-model",
      credentialEnv: "FLOXI_MODEL_KEY_MISSING_TEST",
    });
    endpointId = endpoint.id;
    expect(endpoint.credentialConfigured).toBe(false);
    expect(endpoint).not.toHaveProperty("workspaceId");
    expect((await service.list(actor))[0].id).toBe(endpointId);
    expect(await service.list({ ...actor, workspaceId: foreignId })).toEqual(
      [],
    );
    await expect(
      service.get({ ...actor, workspaceId: foreignId }, endpointId),
    ).rejects.toThrow("not found");
    // Use an unauthenticated local protocol fixture for the remaining checks.
    await db.modelEndpoint.update({
      where: { id: endpointId },
      data: { credentialEnv: null },
    });
  });
  it("tests discovery and generates chat text and usage without persisting prompt content", async () => {
    expect((await service.test(actor, endpointId)).health).toBe("REACHABLE");
    const result = await service.completion(actor, endpointId, {
      prompt: "Fixture prompt",
    });
    expect(result.text).toBe("Chat fixture");
    expect(result.usage.totalTokens).toBe(5);
    expect(requestBody.model).toBe("fixture-model");
    expect(
      await db.audit.count({
        where: { workspaceId, action: "model.completed" },
      }),
    ).toBe(1);
    await expect(
      service.completion({ ...actor, role: "viewer" }, endpointId, {
        prompt: "Denied",
      }),
    ).rejects.toThrow("cannot execute");
    await expect(
      service.test({ ...actor, role: "editor" }, endpointId),
    ).rejects.toThrow("Only administrators");
    await expect(
      service.completion(actor, endpointId, { prompt: "", maxTokens: 99999 }),
    ).rejects.toThrow();
  });
  it("supports Responses protocol and enforces configured embedding dimensions", async () => {
    const endpoint = await service.get(actor, endpointId);
    const result = await complete(
      { ...endpoint, apiStyle: "responses" },
      { prompt: "Hi", system: "Be brief", temperature: 0, maxTokens: 32 },
    );
    expect(result.text).toBe("Responses fixture");
    expect(requestBody.max_output_tokens).toBe(32);
    expect(
      await embeddings(
        { ...endpoint, embeddingModel: "embed", dimensions: 2 },
        ["text"],
      ),
    ).toEqual([[1, 2]]);
    await expect(
      embeddings({ ...endpoint, embeddingModel: "embed", dimensions: 3 }, [
        "text",
      ]),
    ).rejects.toThrow("dimensions");
  });
  it("reports provider errors without leaking response bodies and records failed connection health", async () => {
    mode = "error";
    const tested = await service.test(actor, endpointId);
    expect(tested.health).toBe("ERROR");
    expect(tested.lastError).toContain("HTTP 401");
    expect(tested.lastError).not.toContain("do not disclose");
    await expect(
      service.completion(actor, endpointId, { prompt: "Hi" }),
    ).rejects.toThrow("HTTP 401");
    mode = "invalid";
    await expect(
      service.completion(actor, endpointId, { prompt: "Hi" }),
    ).rejects.toThrow("invalid JSON");
    mode = "ok";
  });
});
