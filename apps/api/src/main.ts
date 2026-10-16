import "reflect-metadata";
import {
  Controller,
  Get,
  Inject,
  Module,
  UseGuards,
  Req,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { Db, DbModule, config } from "./db.js";
import {
  AuthGuard,
  AuthModule,
  AuthService,
  type AuthRequest,
} from "./auth/auth.js";
import { WorkflowsModule } from "./workflows/workflows.js";
import { ExecutionModule } from "./execution/execution.js";
import { enrichOpenApi } from "./openapi.js";
import { realtime } from "./realtime.js";
@Controller("operations")
@UseGuards(AuthGuard)
class OperationsController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("health") async health(@Req() req: AuthRequest) {
    await this.db.$queryRaw`SELECT 1`;
    const queue = await this.db.run.groupBy({
      by: ["status"],
      where: { workflow: { workspaceId: req.actor.workspaceId } },
      _count: true,
    });
    return { database: "connected", queue, version: "0.1.0" };
  }
}
@Module({
  imports: [DbModule, AuthModule, WorkflowsModule, ExecutionModule],
  controllers: [OperationsController],
})
class AppModule {}
const app = await NestFactory.create(AppModule, { bodyParser: true });
app.setGlobalPrefix("api");
app.use(helmet());
app.use(cookieParser());
const attempts = new Map<string, { count: number; until: number }>();
app.use(
  (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    res.setHeader("X-Request-ID", randomUUID());
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-floxi-request"] !== "1"
    ) {
      res.status(403).json({ message: "Missing request verification header." });
      return;
    }
    if (req.headers.origin && req.headers.origin !== config.WEB_ORIGIN) {
      res.status(403).json({ message: "Origin not allowed." });
      return;
    }
    if (req.path.startsWith("/api/auth/") && req.method === "POST") {
      const key = req.ip ?? "local",
        now = Date.now();
      let bucket = attempts.get(key);
      if (!bucket || bucket.until < now) {
        bucket = { count: 0, until: now + 60000 };
        attempts.set(key, bucket);
      }
      if (++bucket.count > 20) {
        res.status(429).json({
          message: "Too many sign-in attempts. Try again in a minute.",
        });
        return;
      }
    }
    next();
  },
);
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle("Floxi.SI API")
    .setVersion("0.1.0")
    .addCookieAuth("floxi_session")
    .build(),
);
SwaggerModule.setup("api/docs", app, enrichOpenApi(document));
const io = realtime(app.getHttpServer(), app.get(Db), app.get(AuthService));
app.enableShutdownHooks();
await app.listen(config.PORT, "127.0.0.1");
process.on("SIGTERM", () => io.close());
