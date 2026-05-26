import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(scriptDir, "..");

const apiDist = resolve(monorepoRoot, "packages/api/dist");
const apiPrisma = resolve(monorepoRoot, "packages/api/prisma");
const webDist = resolve(monorepoRoot, "packages/web/dist");

if (!existsSync(apiDist)) {
  console.error("[vercel-prepare] Missing packages/api/dist — run build:vercel first.");
  process.exit(1);
}

if (!existsSync(webDist)) {
  console.error("[vercel-prepare] Missing packages/web/dist — run build:vercel first.");
  process.exit(1);
}

function bundleApiForHandler(apiDir) {
  const nestDir = resolve(apiDir, "nest");
  rmSync(nestDir, { recursive: true, force: true });
  mkdirSync(nestDir, { recursive: true });
  cpSync(apiDist, nestDir, { recursive: true });
  cpSync(apiPrisma, resolve(nestDir, "prisma"), { recursive: true });
  console.log(`[vercel-prepare] API bundle → ${nestDir}`);
}

bundleApiForHandler(resolve(monorepoRoot, "api"));
bundleApiForHandler(resolve(monorepoRoot, "packages/web/api"));

const repoDist = resolve(monorepoRoot, "dist");

rmSync(repoDist, { recursive: true, force: true });
cpSync(webDist, repoDist, { recursive: true });
console.log(`[vercel-prepare] Web dist → ${repoDist}`);
