import { describe, it, expect } from "vitest";
import { compare, Graph, resolve, validateGraph } from "@floxi/shared";
import { chain, node, reference } from "./fixtures";
describe("graph compiler", () => {
  it("accepts connected versioned graphs and serialization", () => {
    const g = chain(
      node("manual"),
      node("set", { fields: { answer: 42 } }),
      node("response", { body: { done: true } }),
    );
    expect(validateGraph(g)).toEqual([]);
    expect(Graph.parse(JSON.parse(JSON.stringify(g)))).toEqual(g);
  });
  it("rejects missing triggers, responses and disconnected nodes", () => {
    expect(validateGraph(chain(node("set"))).length).toBeGreaterThan(2);
  });
  it("rejects cycles", () => {
    const g = chain(node("manual"), node("set"), node("response"));
    g.edges.push({
      ...g.edges[0],
      id: crypto.randomUUID(),
      source: g.nodes[1].id,
      target: g.nodes[0].id,
    });
    expect(validateGraph(g).join(" ")).toContain("Cycles");
  });
  it("rejects mismatched ports", () => {
    const g = chain(node("manual"), node("response"));
    g.edges[0].sourcePort = "invalid";
    expect(validateGraph(g).join(" ")).toContain("Invalid output");
  });
  it("rejects duplicate IDs and edges", () => {
    const g = chain(node("manual"), node("response"));
    g.edges.push(g.edges[0]);
    expect(validateGraph(g).join(" ")).toContain("unique");
  });
  it("rejects unsupported branch joins", () => {
    const g = chain(node("manual"), node("set"), node("response"));
    g.edges.push({
      ...g.edges[0],
      id: crypto.randomUUID(),
      target: g.nodes[2].id,
    });
    expect(validateGraph(g).join(" ")).toContain("Branch joins");
  });
  it("accepts ancestor mapping and rejects forward references", () => {
    const trigger = node("manual"),
      end = node("response", { body: { name: reference(trigger, "name") } });
    expect(validateGraph(chain(trigger, end))).toEqual([]);
    trigger.parameters = { unexpected: reference(end, "secret") };
    expect(validateGraph(chain(trigger, end)).join(" ")).toContain("upstream");
  });
  it("rejects out of range durable waits", () => {
    expect(
      validateGraph(
        chain(node("manual"), node("wait", { seconds: 0 }), node("response")),
      ).join(" "),
    ).toContain("1 to 3600");
  });
});
describe("safe mapping and comparisons", () => {
  it("maps keys containing dots and slashes using JSON Pointer", () => {
    const n = node("manual");
    expect(
      resolve(reference(n, "/a.b/c~1d"), { [n.id]: { "a.b": { "c/d": 42 } } }),
    ).toBe(42);
  });
  it("compares JSON objects independently of key order", () => {
    expect(compare({ a: 1, b: 2 }, "equals", { b: 2, a: 1 })).toBe(true);
  });
  it("resolves nested arrays and stable node references without eval", () => {
    const n = node("manual");
    expect(
      resolve(
        { customer: reference(n, "items.0.name") },
        { [n.id]: { items: [{ name: "Ada" }] } },
      ),
    ).toEqual({ customer: "Ada" });
  });
  it("fails missing fields instead of copying sample data", () => {
    const n = node("manual");
    expect(() => resolve(reference(n, "missing"), { [n.id]: {} })).toThrow(
      "unavailable",
    );
  });
  it("blocks prototype traversal", () => {
    const n = node("manual");
    expect(() => resolve(reference(n, "__proto__"), { [n.id]: {} })).toThrow(
      "unavailable",
    );
  });
  it("does not coerce numbers for comparisons", () => {
    expect(compare(1, "equals", "1")).toBe(false);
    expect(() => compare("3", "greaterThan", 2)).toThrow();
  });
  it("supports strict contains and branch comparisons", () => {
    expect(compare([1, 2], "contains", 2)).toBe(true);
    expect(compare(3, "greaterThan", 2)).toBe(true);
    expect(compare("abc", "contains", "bc")).toBe(true);
  });
});
