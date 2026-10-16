import { z } from "zod";
export const JsonObject = z.record(z.string(), z.json());
export type Data = z.infer<typeof JsonObject>;
export const NodeType = z.enum([
  "manual",
  "set",
  "condition",
  "wait",
  "response",
]);
export type NodeType = z.infer<typeof NodeType>;
export const Reference = z
  .object({
    mode: z.literal("reference"),
    nodeId: z.uuid(),
    path: z.string().max(200),
  })
  .strict();
export type Reference = z.infer<typeof Reference>;
export const GraphNode = z.object({
  id: z.uuid(),
  type: NodeType,
  typeVersion: z.literal(1),
  label: z.string().trim().min(1).max(100),
  position: z.object({ x: z.number(), y: z.number() }),
  parameters: JsonObject,
});
export const GraphEdge = z.object({
  id: z.uuid(),
  source: z.uuid(),
  target: z.uuid(),
  sourcePort: z.string(),
  targetPort: z.literal("input"),
});
export const Graph = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(GraphNode).max(200),
  edges: z.array(GraphEdge).max(400),
});
export type Graph = z.infer<typeof Graph>;
export type GraphNode = z.infer<typeof GraphNode>;
export type GraphEdge = z.infer<typeof GraphEdge>;
export type Field = {
  key: string;
  label: string;
  kind: "json" | "number" | "value" | "select";
  description: string;
  options?: string[];
  default: unknown;
};
export type Definition = {
  type: NodeType;
  title: string;
  description: string;
  category: string;
  outputs: string[];
  fields: Field[];
};
export const catalog: Definition[] = [
  {
    type: "manual",
    title: "Manual trigger",
    description: "Start a run with a JSON object.",
    category: "Triggers",
    outputs: ["output"],
    fields: [],
  },
  {
    type: "set",
    title: "Set fields",
    description: "Merge a JSON object into the incoming data.",
    category: "Data",
    outputs: ["output"],
    fields: [
      {
        key: "fields",
        label: "Fields to merge",
        kind: "json",
        description:
          "A JSON object. Values can use durable references to prior node outputs.",
        default: {},
      },
    ],
  },
  {
    type: "condition",
    title: "Condition",
    description: "Route data through the true or false output.",
    category: "Logic",
    outputs: ["true", "false"],
    fields: [
      {
        key: "left",
        label: "Left value",
        kind: "value",
        description: "A fixed JSON value or upstream reference.",
        default: "",
      },
      {
        key: "operator",
        label: "Comparison",
        kind: "select",
        description: "Strict comparison without implicit type conversion.",
        options: ["equals", "notEquals", "greaterThan", "contains"],
        default: "equals",
      },
      {
        key: "right",
        label: "Right value",
        kind: "value",
        description: "A fixed JSON value or upstream reference.",
        default: "",
      },
    ],
  },
  {
    type: "wait",
    title: "Wait",
    description: "Pause durably; resumes even after a worker restart.",
    category: "Logic",
    outputs: ["output"],
    fields: [
      {
        key: "seconds",
        label: "Wait in seconds",
        kind: "number",
        description: "Between 1 and 3600 seconds.",
        default: 10,
      },
    ],
  },
  {
    type: "response",
    title: "Response",
    description: "Return a JSON object as the workflow result.",
    category: "Data",
    outputs: [],
    fields: [
      {
        key: "body",
        label: "Response body",
        kind: "json",
        description: "Fixed JSON with optional upstream references.",
        default: {},
      },
    ],
  },
];
export function definition(type: NodeType) {
  return catalog.find((d) => d.type === type)!;
}
export function defaults(type: NodeType): Data {
  return Object.fromEntries(
    definition(type).fields.map((f) => [f.key, f.default]),
  ) as Data;
}
export function validateGraph(graph: Graph): string[] {
  const errors: string[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length) errors.push("Node IDs must be unique.");
  if (new Set(graph.edges.map((e) => e.id)).size !== graph.edges.length)
    errors.push("Edge IDs must be unique.");
  const triggers = graph.nodes.filter((n) => n.type === "manual");
  if (triggers.length !== 1) errors.push("Add exactly one manual trigger.");
  if (!graph.nodes.some((n) => n.type === "response"))
    errors.push("Add a response node.");
  const connections = new Set<string>();
  for (const e of graph.edges) {
    const source = graph.nodes.find((n) => n.id === e.source),
      target = graph.nodes.find((n) => n.id === e.target);
    if (!source || !target) {
      errors.push("A connection points to a missing node.");
      continue;
    }
    if (!definition(source.type).outputs.includes(e.sourcePort))
      errors.push(`Invalid output on ${source.label}.`);
    if (target.type === "manual")
      errors.push("Triggers cannot have incoming connections.");
    const key = `${e.source}:${e.sourcePort}:${e.target}`;
    if (connections.has(key)) errors.push("Duplicate connection.");
    connections.add(key);
  }
  const incoming = (id: string) => graph.edges.filter((e) => e.target === id);
  for (const n of graph.nodes) {
    if (n.type !== "manual" && incoming(n.id).length !== 1)
      errors.push(
        `${n.label}: connect exactly one input. Branch joins are not supported yet.`,
      );
    if (n.type !== "response" && !graph.edges.some((e) => e.source === n.id))
      errors.push(`${n.label}: connect an output.`);
    const p = n.parameters;
    const allowed = new Set(definition(n.type).fields.map((f) => f.key));
    if (Object.keys(p).some((k) => !allowed.has(k)))
      errors.push(`${n.label}: unknown parameter.`);
    if (
      n.type === "wait" &&
      (!Number.isInteger(p.seconds) ||
        Number(p.seconds) < 1 ||
        Number(p.seconds) > 3600)
    )
      errors.push(`${n.label}: wait must be an integer from 1 to 3600.`);
    if (
      n.type === "condition" &&
      (!["equals", "notEquals", "greaterThan", "contains"].includes(
        String(p.operator),
      ) ||
        !("left" in p) ||
        !("right" in p))
    )
      errors.push(`${n.label}: configure both comparison values and operator.`);
    for (const key of n.type === "set"
      ? ["fields"]
      : n.type === "response"
        ? ["body"]
        : []) {
      if (!p[key] || Array.isArray(p[key]) || typeof p[key] !== "object")
        errors.push(`${n.label}: ${key} must be a JSON object.`);
    }
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) {
      errors.push("Cycles are not supported.");
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const e of graph.edges.filter((e) => e.source === id)) visit(e.target);
    visiting.delete(id);
    visited.add(id);
  }
  for (const n of graph.nodes) visit(n.id);
  const reachable = new Set<string>();
  function reach(id: string) {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const e of graph.edges.filter((e) => e.source === id)) reach(e.target);
  }
  if (triggers[0]) reach(triggers[0].id);
  for (const n of graph.nodes)
    if (!reachable.has(n.id))
      errors.push(`${n.label}: unreachable from trigger.`);
  // References must name ancestors; the runtime never resolves arbitrary graph or global data.
  function ancestors(id: string, seen = new Set<string>()): Set<string> {
    for (const e of incoming(id)) {
      if (!seen.has(e.source)) {
        seen.add(e.source);
        ancestors(e.source, seen);
      }
    }
    return seen;
  }
  function refs(value: unknown): Reference[] {
    const r = Reference.safeParse(value);
    if (r.success) return [r.data];
    if (
      value &&
      typeof value === "object" &&
      "mode" in value &&
      value.mode === "reference"
    )
      errors.push("Invalid node-output reference.");
    if (value && typeof value === "object")
      return Object.values(value).flatMap(refs);
    return [];
  }
  for (const n of graph.nodes)
    for (const ref of refs(n.parameters)) {
      if (!ancestors(n.id).has(ref.nodeId) || ref.nodeId === n.id)
        errors.push(
          `${n.label}: mapped values must reference an upstream node.`,
        );
      if (
        referenceParts(ref.path).some((p) =>
          ["__proto__", "prototype", "constructor"].includes(p),
        )
      )
        errors.push("Unsafe reference path.");
    }
  return [...new Set(errors)];
}
export function referenceParts(path: string): string[] {
  return path.startsWith("/")
    ? path
        .slice(1)
        .split("/")
        .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
    : path.split(".").filter(Boolean);
}
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const ka = Object.keys(a),
    kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every(
      (k) =>
        Object.hasOwn(b, k) &&
        equal(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    )
  );
}
export function resolve(
  value: unknown,
  outputs: Record<string, unknown>,
  depth = 0,
): unknown {
  if (depth > 30) throw new Error("Value nesting is too deep.");
  const ref = Reference.safeParse(value);
  if (ref.success) {
    if (!Object.hasOwn(outputs, ref.data.nodeId))
      throw new Error("Mapped upstream output is unavailable.");
    let result = outputs[ref.data.nodeId];
    for (const part of referenceParts(ref.data.path)) {
      if (
        ["__proto__", "constructor", "prototype"].includes(part) ||
        result === null ||
        typeof result !== "object" ||
        !Object.hasOwn(result, part)
      )
        throw new Error(`Mapped path ${ref.data.path} is unavailable.`);
      result = (result as Record<string, unknown>)[part];
    }
    return result;
  }
  if (Array.isArray(value))
    return value.map((v) => resolve(v, outputs, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        resolve(v, outputs, depth + 1),
      ]),
    );
  return value;
}
export function compare(left: unknown, op: unknown, right: unknown): boolean {
  switch (op) {
    case "equals":
      return equal(left, right);
    case "notEquals":
      return !equal(left, right);
    case "greaterThan":
      if (typeof left !== "number" || typeof right !== "number")
        throw new Error("Greater than requires two numbers.");
      return left > right;
    case "contains":
      if (typeof left === "string" && typeof right === "string")
        return left.includes(right);
      if (Array.isArray(left)) return left.some((v) => equal(v, right));
      throw new Error("Contains requires text or an array.");
    default:
      throw new Error("Unsupported operator.");
  }
}
export const WorkflowCreate = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000).default(""),
  })
  .strict();
export const DraftUpdate = WorkflowCreate.extend({
  revision: z.number().int().positive(),
  graph: Graph,
}).strict();
export type Workflow = {
  id: string;
  name: string;
  description: string;
  revision: number;
  graph: Graph;
  publishedVersion: number | null;
  archived: boolean;
  updatedAt: string;
  createdAt: string;
  workspaceId: string;
};
export type Step = {
  nodeId: string;
  status: string;
  input: Data;
  output: Data;
  port: string;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  wakeAt: string | null;
};
export type Run = {
  id: string;
  workflowId: string;
  status: string;
  version: number;
  input: Data;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  steps: Step[];
};

export * from "./ai";
