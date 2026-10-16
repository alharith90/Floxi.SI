import type { OpenAPIObject, SchemaObject } from "@nestjs/swagger";
import { z } from "zod";
import { DraftUpdate, Graph, WorkflowCreate, JsonObject } from "@floxi/shared";
export function enrichOpenApi(doc: OpenAPIObject) {
  doc.components ??= {};
  doc.components.schemas ??= {};
  function schemaFor(name: string, schema: z.ZodType) {
    const source = z.toJSONSchema(schema, { target: "openapi-3.0" }) as Record<
      string,
      unknown
    >;
    const definitions = (source.definitions ?? {}) as Record<string, unknown>;
    delete source.definitions;
    function relocate(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(relocate);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([key, child]) => [
            key,
            key === "$ref" &&
            typeof child === "string" &&
            child.startsWith("#/definitions/")
              ? `#/components/schemas/${name}_${child.slice("#/definitions/".length)}`
              : key === "$ref" && child === "#"
                ? `#/components/schemas/${name}`
                : relocate(child),
          ]),
        );
      return value;
    }
    for (const [key, value] of Object.entries(definitions))
      doc.components!.schemas![`${name}_${key}`] = relocate(
        value,
      ) as SchemaObject;
    doc.components!.schemas![name] = relocate(source) as SchemaObject;
    return { $ref: `#/components/schemas/${name}` };
  }
  const bodies: [string, "post" | "patch", string, z.ZodType][] = [
    [
      "/api/auth/setup",
      "post",
      "SetupRequest",
      z.object({ email: z.email(), password: z.string().min(12).max(128) }),
    ],
    [
      "/api/auth/login",
      "post",
      "LoginRequest",
      z.object({ email: z.email(), password: z.string().min(12).max(128) }),
    ],
    ["/api/workflows", "post", "CreateWorkflowRequest", WorkflowCreate],
    ["/api/workflows/{id}/draft", "patch", "DraftUpdateRequest", DraftUpdate],
    [
      "/api/workflows/{id}/publish",
      "post",
      "PublishRequest",
      z.object({ revision: z.number().int().positive() }),
    ],
    [
      "/api/workflows/{id}/archive",
      "post",
      "ArchiveRequest",
      z.object({ archived: z.boolean() }),
    ],
    [
      "/api/workflows/{id}/runs",
      "post",
      "RunRequest",
      z.object({ input: JsonObject, idempotencyKey: z.uuid().optional() }),
    ],
  ];
  for (const [path, method, name, schema] of bodies) {
    const operation = doc.paths[path]?.[method];
    if (operation)
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: schemaFor(name, schema) } },
      };
  }
  schemaFor("WorkflowGraph", Graph);
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of ["get", "post", "patch"] as const) {
      const operation = item?.[method];
      if (!operation) continue;
      operation.security =
        path.startsWith("/api/auth/") && path !== "/api/auth/me"
          ? []
          : [{ cookie: [] }];
      if (path.includes("{id}"))
        operation.parameters = [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ];
    }
  }
  return doc;
}
