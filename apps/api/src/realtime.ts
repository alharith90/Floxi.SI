import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import type { AuthService } from "./auth/auth.js";
import type { Db } from "./db.js";
import { config } from "./db.js";
export function realtime(http: HttpServer, db: Db, auth: AuthService) {
  const io = new Server(http, {
    cors: { origin: config.WEB_ORIGIN, credentials: true },
    allowRequest: (req, done) =>
      done(
        null,
        !req.headers.origin || req.headers.origin === config.WEB_ORIGIN,
      ),
  });
  io.use(async (socket, next) => {
    const token = socket.request.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("floxi_session="))
      ?.slice("floxi_session=".length);
    try {
      await auth.actor(token);
      next();
    } catch {
      next(new Error("Sign in required."));
    }
  });
  io.on("connection", (socket) => {
    let cursor = 0,
      runId = "",
      busy = false;
    const token = socket.request.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("floxi_session="))
      ?.slice("floxi_session=".length);
    socket.on("subscribe", async (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const p = payload as Record<string, unknown>;
      if (
        typeof p.runId !== "string" ||
        typeof p.after !== "number" ||
        !Number.isSafeInteger(p.after) ||
        p.after < 0
      )
        return;
      try {
        const actor = await auth.actor(token);
        const run = await db.run.findFirst({
          where: { id: p.runId, workflow: { workspaceId: actor.workspaceId } },
        });
        if (!run) {
          socket.emit("access.error", "Execution not found.");
          return;
        }
        runId = run.id;
        cursor = p.after;
      } catch {
        socket.disconnect();
      }
    });
    const timer = setInterval(async () => {
      if (!runId || busy) return;
      busy = true;
      try {
        const actor = await auth.actor(token);
        if (
          !(await db.run.count({
            where: { id: runId, workflow: { workspaceId: actor.workspaceId } },
          }))
        ) {
          socket.disconnect();
          return;
        }
        const events = await db.runEvent.findMany({
          where: { runId, sequence: { gt: cursor } },
          orderBy: { sequence: "asc" },
          take: 100,
        });
        for (const event of events) {
          socket.emit("execution.event", event);
          cursor = event.sequence;
        }
      } catch {
        socket.disconnect();
      } finally {
        busy = false;
      }
    }, 500);
    socket.on("disconnect", () => clearInterval(timer));
  });
  return io;
}
