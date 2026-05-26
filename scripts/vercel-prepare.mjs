import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(scriptDir, "..");

function findWebBuildOutput() {
  const candidates = [
    resolve(monorepoRoot, "packages/web/dist"),
    resolve(monorepoRoot, "dist"),
  ];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, "index.html"))) return dir;
  }
  return null;
}

const webBuilt = findWebBuildOutput();
if (!webBuilt) {
  console.error("[vercel-prepare] No frontend build found (index.html missing).");
  process.exit(1);
}

const apiDist = resolve(monorepoRoot, "packages/api/dist");
const apiPrisma = resolve(monorepoRoot, "packages/api/prisma");

if (!existsSync(apiDist)) {
  console.error("[vercel-prepare] Missing packages/api/dist — run build:vercel first.");
  process.exit(1);
}

function bundleApiForHandler(serverDir) {
  const nestDir = resolve(serverDir, "nest");
  rmSync(nestDir, { recursive: true, force: true });
  mkdirSync(nestDir, { recursive: true });
  cpSync(apiDist, nestDir, { recursive: true });
  cpSync(apiPrisma, resolve(nestDir, "prisma"), { recursive: true });
  console.log(`[vercel-prepare] API bundle → ${nestDir}`);
}

function mirrorStatic(targetDir) {
  const target = resolve(targetDir);
  const source = resolve(webBuilt);
  if (target === source) {
    console.log(`[vercel-prepare] Static OK at ${target}`);
    return;
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[vercel-prepare] Static → ${target}`);
}

function removeBuildOutputApiArtifacts() {
  for (const dir of [
    resolve(monorepoRoot, ".vercel/output"),
    resolve(monorepoRoot, "packages/web/.vercel/output"),
  ]) {
    rmSync(dir, { recursive: true, force: true });
  }
}

removeBuildOutputApiArtifacts();

for (const legacy of [
  resolve(monorepoRoot, "api/nest"),
  resolve(monorepoRoot, "packages/web/api/nest"),
]) {
  rmSync(legacy, { recursive: true, force: true });
}

bundleApiForHandler(resolve(monorepoRoot, "server"));
bundleApiForHandler(resolve(monorepoRoot, "packages/web/server"));

for (const dir of [
  resolve(monorepoRoot, "packages/web/dist"),
  resolve(monorepoRoot, "packages/web/public"),
  resolve(monorepoRoot, "dist"),
  resolve(monorepoRoot, "public"),
]) {
  mirrorStatic(dir);
}

const mustExist = [
  resolve(monorepoRoot, "packages/web/dist/index.html"),
  resolve(monorepoRoot, "packages/web/public/index.html"),
];

for (const file of mustExist) {
  if (!existsSync(file)) {
    console.error(`[vercel-prepare] Required output missing: ${file}`);
    process.exit(1);
  }
}

console.log("[vercel-prepare] Done — dist, public, server/nest ready (classic Vercel output)");
