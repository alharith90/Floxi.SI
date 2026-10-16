import { Prisma, PrismaClient } from "@prisma/client";
import {
  compare,
  Graph,
  resolve,
  validateGraph,
  type Data,
} from "@floxi/shared";
import { json } from "../json.js";
// A step and its checkpoint commit in one short transaction. Only pure, bounded
// node handlers are admitted in this first release. No external effects to replay.
export async function tick(db: PrismaClient): Promise<boolean> {
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Run" WHERE status IN ('QUEUED','RUNNING','WAITING') AND ("leaseUntil" IS NULL OR "leaseUntil" <= NOW()) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return false;
      const run = await tx.run.findUniqueOrThrow({
        where: { id: rows[0].id },
        include: { steps: true },
      });
      const event = async (type: string, nodeId?: string) => {
        await tx.runEvent.create({ data: { runId: run.id, type, nodeId } });
      };
      try {
        const graph = Graph.parse(run.graph);
        const errors = validateGraph(graph);
        if (errors.length) throw new Error(errors[0]);
        if (Date.now() - run.createdAt.getTime() > 24 * 3600000)
          throw new Error("Run exceeded its 24-hour deadline.");
        if (run.status === "QUEUED") {
          await tx.run.update({
            where: { id: run.id },
            data: { status: "RUNNING" },
          });
          await event("run.started");
        }
        const steps = new Map(run.steps.map((s) => [s.nodeId, s]));
        const outputs = Object.fromEntries(
          run.steps
            .filter((s) => s.status === "SUCCEEDED")
            .map((s) => [s.nodeId, s.output]),
        );
        let progressed = false;
        for (const node of graph.nodes) {
          const previous = steps.get(node.id);
          if (previous && previous.status !== "WAITING") continue;
          const incoming = graph.edges.filter((e) => e.target === node.id);
          if (
            incoming.some(
              (e) =>
                !steps.has(e.source) ||
                steps.get(e.source)?.status === "WAITING",
            )
          )
            continue;
          const active = incoming.filter((e) => {
            const s = steps.get(e.source);
            return s?.status === "SUCCEEDED" && s.port === e.sourcePort;
          });
          const input = (
            node.type === "manual"
              ? run.input
              : active[0]
                ? steps.get(active[0].source)!.output
                : {}
          ) as Data;
          if (node.type !== "manual" && !active.length) {
            await tx.step.create({
              data: {
                runId: run.id,
                nodeId: node.id,
                status: "SKIPPED",
                input: {},
                output: {},
                finishedAt: new Date(),
              },
            });
            await event("node.skipped", node.id);
            progressed = true;
            break;
          }
          try {
            const p = resolve(node.parameters, outputs) as Record<
              string,
              unknown
            >;
            if (node.type === "wait" && !previous) {
              const wakeAt = new Date(Date.now() + Number(p.seconds) * 1000);
              await tx.step.create({
                data: {
                  runId: run.id,
                  nodeId: node.id,
                  status: "WAITING",
                  input: json(input),
                  output: {},
                  wakeAt,
                },
              });
              await tx.run.update({
                where: { id: run.id },
                data: { status: "WAITING", leaseUntil: wakeAt },
              });
              await event("node.waiting", node.id);
              return true;
            }
            if (previous?.wakeAt && previous.wakeAt > new Date()) continue;
            let output: unknown = input,
              port = "output";
            if (node.type === "set") {
              if (
                !p.fields ||
                typeof p.fields !== "object" ||
                Array.isArray(p.fields)
              )
                throw new Error("Set fields must resolve to a JSON object.");
              output = { ...input, ...p.fields };
            }
            if (node.type === "condition")
              port = compare(p.left, p.operator, p.right) ? "true" : "false";
            if (node.type === "response") {
              if (
                !p.body ||
                typeof p.body !== "object" ||
                Array.isArray(p.body)
              )
                throw new Error("Response body must resolve to a JSON object.");
              output = p.body;
            }
            if (JSON.stringify(output).length > 262144)
              throw new Error(
                "Node output exceeds the 256 KiB development limit.",
              );
            await event("node.started", node.id);
            const data = {
              status: "SUCCEEDED",
              input: json(input),
              output: json(output),
              port,
              finishedAt: new Date(),
            };
            await tx.step.upsert({
              where: { runId_nodeId: { runId: run.id, nodeId: node.id } },
              create: { ...data, runId: run.id, nodeId: node.id },
              update: data,
            });
            await tx.run.update({
              where: { id: run.id },
              data: { status: "RUNNING", leaseUntil: null },
            });
            await event("node.succeeded", node.id);
            progressed = true;
            break;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Node failed.";
            await tx.step.upsert({
              where: { runId_nodeId: { runId: run.id, nodeId: node.id } },
              create: {
                runId: run.id,
                nodeId: node.id,
                status: "FAILED",
                input: json(input),
                output: {},
                error: message,
                finishedAt: new Date(),
              },
              update: {
                status: "FAILED",
                error: message,
                finishedAt: new Date(),
              },
            });
            await event("node.failed", node.id);
            throw new Error(message);
          }
        }
        if (!progressed) {
          if (run.steps.length !== graph.nodes.length)
            throw new Error(
              "No runnable nodes remain. Check branch connections.",
            );
          await tx.run.update({
            where: { id: run.id },
            data: {
              status: "SUCCEEDED",
              finishedAt: new Date(),
              leaseUntil: null,
            },
          });
          await event("run.completed");
        }
      } catch (error) {
        const errorText =
          error instanceof Error ? error.message : "Execution failed.";
        await tx.run.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            error: errorText,
            finishedAt: new Date(),
            leaseUntil: null,
          },
        });
        await event("run.failed");
      }
      return true;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10000,
    },
  );
}
