import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ConflictException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JsonObject } from "@floxi/shared";
import { AuthGuard, AuthModule, type AuthRequest } from "../auth/auth.js";
import { Db, DbModule } from "../db.js";
import {
  WorkflowsModule,
  WorkflowsService,
  json,
  parse,
  permit,
  uuid,
} from "../workflows/workflows.js";
@ApiTags("Executions")
@UseGuards(AuthGuard)
@Controller()
export class ExecutionController {
  constructor(
    @Inject(Db) private db: Db,
    @Inject(WorkflowsService) private workflows: WorkflowsService,
  ) {}
  @Post("workflows/:id/runs") async create(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    permit(r.actor, "execute");
    const w = await this.workflows.get(r.actor, id);
    if (!w.publishedVersion || w.archived)
      throw new ConflictException("Publish an active workflow before running.");
    const payload = parse(
      z
        .object({ input: JsonObject, idempotencyKey: z.uuid().optional() })
        .strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workflow" WHERE id=${id}::uuid FOR UPDATE`;
      const current = await tx.workflow.findUniqueOrThrow({ where: { id } });
      if (current.archived || !current.publishedVersion)
        throw new ConflictException(
          "Publish an active workflow before running.",
        );
      if (payload.idempotencyKey) {
        const existing = await tx.run.findUnique({
          where: {
            workflowId_idempotencyKey: {
              workflowId: id,
              idempotencyKey: payload.idempotencyKey,
            },
          },
        });
        if (existing) return existing;
      }
      const active = await tx.run.count({
        where: {
          workflow: { workspaceId: r.actor.workspaceId },
          status: { in: ["QUEUED", "RUNNING", "WAITING"] },
        },
      });
      if (active >= 100)
        throw new ConflictException(
          "The workspace already has 100 active runs. Wait for completion or cancel a run.",
        );
      const version = await tx.version.findUniqueOrThrow({
        where: {
          workflowId_number: {
            workflowId: id,
            number: current.publishedVersion,
          },
        },
      });
      const run = await tx.run.create({
        data: {
          workflowId: id,
          version: version.number,
          graph: version.graph!,
          input: json(payload.input),
          idempotencyKey: payload.idempotencyKey,
        },
      });
      await tx.runEvent.create({
        data: { runId: run.id, type: "run.created" },
      });
      await tx.audit.create({
        data: this.workflows.audit(r.actor, "run.created", run.id),
      });
      return run;
    });
  }

  @Get("executions") list(
    @Req() r: AuthRequest,
    @Query("workflowId") workflowId?: string,
  ) {
    if (workflowId) uuid(workflowId);
    return this.db.run.findMany({
      where: {
        workflow: { workspaceId: r.actor.workspaceId },
        ...(workflowId ? { workflowId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        workflowId: true,
        version: true,
        status: true,
        error: true,
        createdAt: true,
        finishedAt: true,
        workflow: { select: { name: true } },
      },
    });
  }
  async get(r: AuthRequest, id: string) {
    const run = await this.db.run.findFirst({
      where: { id: uuid(id), workflow: { workspaceId: r.actor.workspaceId } },
      include: { steps: { orderBy: { startedAt: "asc" } } },
    });
    if (!run) throw new NotFoundException("Execution not found.");
    return run;
  }
  @Get("executions/:id") getRun(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.get(r, id);
  }
  @Get("executions/:id/events") async events(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Query("after") after = "0",
  ) {
    await this.get(r, id);
    const cursor = parse(z.coerce.number().int().min(0), after);
    return this.db.runEvent.findMany({
      where: { runId: id, sequence: { gt: cursor } },
      orderBy: { sequence: "asc" },
      take: 100,
    });
  }
  @Post("executions/:id/cancel") async cancel(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    permit(r.actor, "execute");
    await this.get(r, id);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.run.updateMany({
        where: { id, status: { in: ["QUEUED", "RUNNING", "WAITING"] } },
        data: { status: "CANCELLED", finishedAt: new Date(), leaseUntil: null },
      });
      if (changed.count) {
        await tx.step.updateMany({
          where: { runId: id, status: "WAITING" },
          data: { status: "CANCELLED", finishedAt: new Date() },
        });
        await tx.runEvent.create({
          data: { runId: id, type: "run.cancelled" },
        });
      }
      return { cancelled: changed.count === 1 };
    });
  }
}
@Module({
  imports: [DbModule, AuthModule, WorkflowsModule],
  controllers: [ExecutionController],
})
export class ExecutionModule {}
