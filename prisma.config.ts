import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
export default defineConfig({
  experimental: { adapter: true },
  schema: "apps/api/prisma/schema.prisma",
  migrations: { path: "apps/api/prisma/migrations" },
  engine: "js",
  adapter: async () =>
    new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
