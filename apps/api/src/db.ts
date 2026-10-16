import "dotenv/config";
import {
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
export const config = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().default(3001),
    WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
    COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  })
  .parse(process.env);
@Injectable()
export class Db extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
@Module({ providers: [Db], exports: [Db] })
export class DbModule {}
