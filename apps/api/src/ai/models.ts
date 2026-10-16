import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { ModelEndpoint } from "@prisma/client";
import { EndpointCreate, CompletionRequest } from "@floxi/shared";
import { Db, DbModule } from "../db.js";
import {
  AuthGuard,
  AuthModule,
  type Actor,
  type AuthRequest,
} from "../auth/auth.js";
import { parse, permit, uuid } from "../workflows/workflows.js";
import {
  complete,
  providerRequest,
  ProviderError,
  validateProviderUrl,
} from "./provider.js";
@Injectable()
export class ModelsService {
  constructor(@Inject(Db) private db: Db) {}
  publicEndpoint(endpoint: ModelEndpoint) {
    const { workspaceId, ...safe } = endpoint;
    void workspaceId;
    return {
      ...safe,
      credentialConfigured: endpoint.credentialEnv
        ? Boolean(process.env[endpoint.credentialEnv])
        : false,
    };
  }
  async get(actor: Actor, id: string) {
    const endpoint = await this.db.modelEndpoint.findFirst({
      where: { id: uuid(id), workspaceId: actor.workspaceId },
    });
    if (!endpoint) throw new NotFoundException("Model endpoint not found.");
    return endpoint;
  }
  async list(actor: Actor) {
    return (
      await this.db.modelEndpoint.findMany({
        where: { workspaceId: actor.workspaceId },
        orderBy: { createdAt: "desc" },
      })
    ).map((e) => this.publicEndpoint(e));
  }
  async create(actor: Actor, body: unknown) {
    if (actor.role !== "admin")
      throw new ForbiddenException(
        "Only administrators can configure model endpoints.",
      );
    const p = parse(EndpointCreate, body);
    try {
      p.baseUrl = validateProviderUrl(p.baseUrl);
    } catch (error) {
      if (error instanceof ProviderError || error instanceof TypeError)
        throw new BadRequestException(error.message);
      throw error;
    }
    return this.db.$transaction(async (tx) => {
      const endpoint = await tx.modelEndpoint.create({
        data: { ...p, workspaceId: actor.workspaceId },
      });
      await tx.audit.create({
        data: {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: "model.created",
          resourceId: endpoint.id,
        },
      });
      return this.publicEndpoint(endpoint);
    });
  }
  async test(actor: Actor, id: string) {
    if (actor.role !== "admin")
      throw new ForbiddenException(
        "Only administrators can test model connections.",
      );
    const endpoint = await this.get(actor, id);
    let health = "REACHABLE",
      lastError: string | null = null;
    try {
      const response = await providerRequest(endpoint, "models", undefined);
      if (
        !response ||
        typeof response !== "object" ||
        !("data" in response) ||
        !Array.isArray(response.data)
      )
        throw new ProviderError(
          "Provider returned an unsupported model discovery response.",
        );
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      health = "ERROR";
      lastError = error.message;
    }
    return this.publicEndpoint(
      await this.db.modelEndpoint.update({
        where: { id: endpoint.id },
        data: { health, lastError, testedAt: new Date() },
      }),
    );
  }
  async completion(actor: Actor, id: string, body: unknown) {
    permit(actor, "execute");
    const p = parse(CompletionRequest, body),
      endpoint = await this.get(actor, id);
    try {
      const result = await complete(endpoint, p);
      await this.db.audit.create({
        data: {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: "model.completed",
          resourceId: endpoint.id,
        },
      });
      return result;
    } catch (error) {
      if (error instanceof ProviderError)
        throw new BadGatewayException(error.message);
      throw error;
    }
  }
}
@ApiTags("Models")
@UseGuards(AuthGuard)
@Controller("models")
export class ModelsController {
  constructor(@Inject(ModelsService) private service: ModelsService) {}
  @Get() list(@Req() r: AuthRequest) {
    return this.service.list(r.actor);
  }
  @Post() create(@Req() r: AuthRequest, @Body() body: unknown) {
    return this.service.create(r.actor, body);
  }
  @Post(":id/test") test(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.service.test(r.actor, id);
  }
  @Post(":id/completions") completion(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.completion(r.actor, id, body);
  }
}
@Module({
  imports: [DbModule, AuthModule],
  providers: [ModelsService],
  controllers: [ModelsController],
})
export class ModelsModule {}
