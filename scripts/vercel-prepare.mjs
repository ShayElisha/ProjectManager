import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(scriptDir, "..");

function run(cmd, cwd = monorepoRoot) {
  execSync(cmd, { cwd, stdio: "inherit", env: process.env });
}

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
if (!existsSync(apiDist)) {
  console.error("[vercel-prepare] Missing packages/api/dist — run build:vercel first.");
  process.exit(1);
}

/** Self-contained API + node_modules for Vercel serverless (pnpm deploy). */
function deployApiRuntime(targetDir) {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(dirname(targetDir), { recursive: true });
  console.log(`[vercel-prepare] pnpm deploy → ${targetDir}`);
  run(`pnpm --filter @nexus/api deploy "${targetDir}"`);
  console.log(`[vercel-prepare] prisma generate in runtime`);
  run("pnpm exec prisma generate --schema=./prisma/schema.prisma", targetDir);
  const entry = resolve(targetDir, "dist/serverless.js");
  if (!existsSync(entry)) {
    console.error(`[vercel-prepare] Missing ${entry}`);
    process.exit(1);
  }
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

for (const dir of [
  resolve(monorepoRoot, ".vercel/output"),
  resolve(monorepoRoot, "packages/web/.vercel/output"),
]) {
  rmSync(dir, { recursive: true, force: true });
}

const webRuntime = resolve(monorepoRoot, "packages/web/api/runtime");
const rootRuntime = resolve(monorepoRoot, "api/runtime");

deployApiRuntime(webRuntime);
cpSync(webRuntime, rootRuntime, { recursive: true });
console.log(`[vercel-prepare] API runtime copied → ${rootRuntime}`);

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
  resolve(webRuntime, "dist/serverless.js"),
  resolve(webRuntime, "node_modules/@nestjs/common/package.json"),
];

for (const file of mustExist) {
  if (!existsSync(file)) {
    console.error(`[vercel-prepare] Required output missing: ${file}`);
    process.exit(1);
  }
}

console.log("[vercel-prepare] Done — static + api/runtime ready for Vercel");
