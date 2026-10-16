import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  catalog,
  DraftUpdate,
  Graph,
  validateGraph,
  WorkflowCreate,
} from "@floxi/shared";
import { Db, DbModule } from "../db.js";
import {
  AuthGuard,
  AuthModule,
  type Actor,
  type AuthRequest,
} from "../auth/auth.js";
export { json } from "../json.js";
import { json } from "../json.js";
export function permit(a: Actor, action: "edit" | "publish" | "execute") {
  const roles =
    action === "publish"
      ? ["admin", "publisher"]
      : action === "execute"
        ? ["admin", "publisher", "editor", "operator"]
        : ["admin", "publisher", "editor"];
  if (!roles.includes(a.role))
    throw new ForbiddenException(`Your role cannot ${action} workflows.`);
}
export function uuid(id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new BadRequestException("Invalid identifier.");
  return id;
}
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const p = schema.safeParse(body);
  if (!p.success)
    throw new BadRequestException(
      p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return p.data;
}
@Injectable()
export class WorkflowsService {
  constructor(@Inject(Db) public db: Db) {}
  async get(a: Actor, id: string) {
    const w = await this.db.workflow.findFirst({
      where: { id: uuid(id), workspaceId: a.workspaceId },
    });
    if (!w) throw new NotFoundException("Workflow not found.");
    return w;
  }
  audit(a: Actor, action: string, resourceId: string) {
    return {
      workspaceId: a.workspaceId,
      actorId: a.userId,
      action,
      resourceId,
    };
  }
  async create(a: Actor, body: unknown) {
    permit(a, "edit");
    const p = parse(WorkflowCreate, body);
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const flow = await tx.workflow.create({
        data: {
          ...p,
          id,
          workspaceId: a.workspaceId,
          graph: { schemaVersion: 1, nodes: [], edges: [] },
        },
      });
      await tx.audit.create({ data: this.audit(a, "workflow.created", id) });
      return flow;
    });
  }
  async save(a: Actor, id: string, body: unknown) {
    permit(a, "edit");
    await this.get(a, id);
    const p = parse(DraftUpdate, body);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.workflow.updateMany({
        where: {
          id,
          workspaceId: a.workspaceId,
          revision: p.revision,
          archived: false,
        },
        data: {
          name: p.name,
          description: p.description,
          graph: json(p.graph),
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "This draft changed in another session or was archived. Reload before editing. Your local changes are preserved.",
        );
      await tx.audit.create({ data: this.audit(a, "workflow.saved", id) });
      return tx.workflow.findUniqueOrThrow({ where: { id } });
    });
  }
  async publish(a: Actor, id: string, revision: number) {
    permit(a, "publish");
    return this.db.$transaction(async (tx) => {
      const w = await tx.workflow.findFirst({
        where: { id: uuid(id), workspaceId: a.workspaceId },
      });
      if (!w) throw new NotFoundException("Workflow not found.");
      if (w.revision !== revision || w.archived)
        throw new ConflictException(
          "Reload the current draft before publishing.",
        );
      const graph = parse(Graph, w.graph),
        errors = validateGraph(graph);
      if (errors.length) throw new BadRequestException(errors.join("\n"));
      const number = (w.publishedVersion ?? 0) + 1;
      const lock = await tx.workflow.updateMany({
        where: { id, revision, publishedVersion: w.publishedVersion },
        data: { publishedVersion: number, revision: { increment: 1 } },
      });
      if (lock.count !== 1)
        throw new ConflictException("Another publication won. Reload.");
      await tx.version.create({
        data: { workflowId: id, number, graph: json(graph) },
      });
      await tx.audit.create({ data: this.audit(a, "workflow.published", id) });
      return tx.workflow.findUniqueOrThrow({ where: { id } });
    });
  }
}
@ApiTags("Workflows")
@UseGuards(AuthGuard)
@Controller()
export class WorkflowsController {
  constructor(@Inject(WorkflowsService) private service: WorkflowsService) {}
  @Get("nodes/catalog") catalog() {
    return catalog;
  }
  @Get("studio/apps") async list(
    @Req() r: AuthRequest,
    @Query("q") q = "",
    @Query("archived") archived = "false",
  ) {
    return this.service.db.workflow.findMany({
      where: {
        workspaceId: r.actor.workspaceId,
        archived: archived === "true",
        OR: [
          { name: { contains: q.slice(0, 100), mode: "insensitive" } },
          { description: { contains: q.slice(0, 100), mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }
  @Post("workflows")
  @ApiOperation({ summary: "Create a durable empty draft" })
  create(@Req() r: AuthRequest, @Body() body: unknown) {
    return this.service.create(r.actor, body);
  }
  @Get("workflows/:id") get(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.service.get(r.actor, id);
  }
  @Patch("workflows/:id/draft") save(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.save(r.actor, id, body);
  }
  @Post("workflows/:id/validate") async validate(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    const w = await this.service.get(r.actor, id);
    return { errors: validateGraph(parse(Graph, w.graph)) };
  }
  @Post("workflows/:id/publish") publish(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.publish(
      r.actor,
      id,
      parse(z.object({ revision: z.number().int().positive() }).strict(), body)
        .revision,
    );
  }
  @Get("workflows/:id/versions") async versions(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    await this.service.get(r.actor, id);
    return this.service.db.version.findMany({
      where: { workflowId: id },
      orderBy: { number: "desc" },
    });
  }
  @Post("workflows/:id/archive") async archive(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    permit(r.actor, "edit");
    await this.service.get(r.actor, id);
    const p = parse(z.object({ archived: z.boolean() }).strict(), body);
    return this.service.db.$transaction(async (tx) => {
      const w = await tx.workflow.update({
        where: { id },
        data: { archived: p.archived, revision: { increment: 1 } },
      });
      await tx.audit.create({
        data: this.service.audit(
          r.actor,
          p.archived ? "workflow.archived" : "workflow.restored",
          id,
        ),
      });
      return w;
    });
  }
  @Post("workflows/:id/duplicate") async duplicate(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    permit(r.actor, "edit");
    const w = await this.service.get(r.actor, id);
    const copy = await this.service.create(r.actor, {
      name: w.name.slice(0, 90) + " (copy)",
      description: w.description,
    });
    return this.service.save(r.actor, copy.id, {
      name: copy.name,
      description: copy.description,
      revision: copy.revision,
      graph: w.graph,
    });
  }
}
@Module({
  imports: [DbModule, AuthModule],
  providers: [WorkflowsService],
  controllers: [WorkflowsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
