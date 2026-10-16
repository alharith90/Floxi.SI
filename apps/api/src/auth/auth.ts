import {
  BadRequestException,
  Body,
  CanActivate,
  ConflictException,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { Db, DbModule, config } from "../db.js";
const credentials = z
  .object({
    email: z.email().transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export type Actor = {
  userId: string;
  workspaceId: string;
  role: string;
  email: string;
  workspaceName?: string;
};
export type AuthRequest = Request & { actor: Actor };
function digest(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
@Injectable()
export class AuthService {
  constructor(@Inject(Db) private db: Db) {}
  async actor(token: unknown): Promise<Actor> {
    if (typeof token !== "string" || token.length > 200)
      throw new UnauthorizedException("Please sign in.");
    const session = await this.db.session.findUnique({
      where: { id: digest(token) },
      include: {
        user: { include: { memberships: { include: { workspace: true } } } },
      },
    });
    if (!session || session.expiresAt < new Date())
      throw new UnauthorizedException("Session expired. Please sign in.");
    const member = session.user.memberships[0];
    if (!member) throw new UnauthorizedException("No workspace membership.");
    return {
      userId: session.userId,
      workspaceId: member.workspaceId,
      role: member.role,
      email: session.user.email,
      workspaceName: member.workspace.name,
    };
  }
  async session(userId: string, res: Response) {
    const token = randomBytes(32).toString("hex");
    await this.db.session.create({
      data: {
        id: digest(token),
        userId,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    res.cookie("floxi_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: config.COOKIE_SECURE === "true",
      maxAge: 86400000,
      path: "/",
    });
    return this.actor(token);
  }
  async logout(token: unknown) {
    if (typeof token === "string")
      await this.db.session.deleteMany({ where: { id: digest(token) } });
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    req.actor = await this.auth.actor(req.cookies?.floxi_session);
    return true;
  }
}
@ApiTags("Identity")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(Db) private db: Db,
    @Inject(AuthService) private auth: AuthService,
  ) {}
  @Get("status") async status() {
    return { needsSetup: (await this.db.user.count()) === 0 };
  }
  @Post("setup") async setup(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = credentials.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        "Use a valid email and a password of 12–128 characters.",
      );
    const salt = randomBytes(16).toString("hex"),
      hash = scryptSync(parsed.data.password, salt, 64).toString("hex");
    const user = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(825901)`;
      if (await tx.user.count())
        throw new ConflictException("Setup is complete. Sign in.");
      return tx.user.create({
        data: {
          email: parsed.data.email,
          passwordHash: `${salt}:${hash}`,
          memberships: {
            create: {
              role: "admin",
              workspace: { create: { name: "Floxi Workspace" } },
            },
          },
        },
      });
    });
    return this.auth.session(user.id, res);
  }
  @Post("login") async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const p = credentials.safeParse(body);
    if (!p.success)
      throw new UnauthorizedException("Invalid email or password.");
    const user = await this.db.user.findUnique({
      where: { email: p.data.email },
    });
    const [salt, hash] = (
      user?.passwordHash ?? "0000000000000000:" + "0".repeat(128)
    ).split(":");
    const actual = scryptSync(p.data.password, salt, 64);
    if (!user || !timingSafeEqual(actual, Buffer.from(hash, "hex")))
      throw new UnauthorizedException("Invalid email or password.");
    return this.auth.session(user.id, res);
  }
  @Get("me") async me(@Req() req: Request) {
    return this.auth.actor(req.cookies?.floxi_session);
  }
  @Post("logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.floxi_session);
    res.clearCookie("floxi_session", { path: "/" });
    return { ok: true };
  }
}
@Module({
  imports: [DbModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
