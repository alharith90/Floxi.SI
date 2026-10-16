import { defineConfig } from "tsup";
export default defineConfig({
  tsconfig: "tsconfig.api-build.json",
  entry: ["apps/api/src/main.ts", "apps/api/src/worker.ts"],
  format: ["esm"],
  outDir: "dist/api",
  clean: true,
  sourcemap: true,
  noExternal: ["@floxi/shared"],
  target: "es2023",
});
