import { randomUUID } from "node:crypto";
import {
  defaults,
  type Graph,
  type GraphNode,
  type NodeType,
} from "@floxi/shared";
export function node(type: NodeType, parameters = defaults(type)): GraphNode {
  return {
    id: randomUUID(),
    type,
    typeVersion: 1,
    label: type,
    position: { x: 0, y: 0 },
    parameters,
  };
}
export function chain(...nodes: GraphNode[]): Graph {
  return {
    schemaVersion: 1,
    nodes,
    edges: nodes.slice(1).map((n, i) => ({
      id: randomUUID(),
      source: nodes[i].id,
      target: n.id,
      sourcePort: nodes[i].type === "condition" ? "true" : "output",
      targetPort: "input",
    })),
  };
}
export function reference(node: GraphNode, path: string) {
  return { mode: "reference", nodeId: node.id, path };
}
