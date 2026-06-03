import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
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

/** pnpm deploy omits generated `.prisma/client` — copy from workspace after `prisma generate`. */
function findGeneratedPrismaClientDir() {
  const candidates = [
    resolve(monorepoRoot, "node_modules/.prisma/client"),
    resolve(monorepoRoot, "packages/api/node_modules/.prisma/client"),
  ];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, "index.js"))) return dir;
  }
  const pnpmStore = resolve(monorepoRoot, "node_modules/.pnpm");
  if (existsSync(pnpmStore)) {
    for (const name of readdirSync(pnpmStore)) {
      if (!name.startsWith("@prisma+client@")) continue;
      const dir = resolve(pnpmStore, name, "node_modules/.prisma/client");
      if (existsSync(resolve(dir, "index.js"))) return dir;
    }
  }
  return null;
}

function copyPrismaClientToRuntime(targetDir) {
  const src = findGeneratedPrismaClientDir();
  if (!src) {
    console.error(
      "[vercel-prepare] Prisma client missing. Ensure packages/api build ran prisma generate.",
    );
    process.exit(1);
  }
  const dest = resolve(targetDir, "node_modules/.prisma/client");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(resolve(targetDir, "node_modules/.prisma"), { recursive: true });
  cpSync(src, dest, { recursive: true });
  const linuxEngine = resolve(dest, "libquery_engine-rhel-openssl-3.0.x.so.node");
  if (!existsSync(linuxEngine)) {
    console.error(`[vercel-prepare] Missing Vercel Prisma engine: ${linuxEngine}`);
    process.exit(1);
  }
  console.log(`[vercel-prepare] Prisma client → ${dest}`);
}

/** Self-contained API + production node_modules for Vercel serverless. */
function deployApiRuntime(targetDir) {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(dirname(targetDir), { recursive: true });
  console.log(`[vercel-prepare] pnpm deploy --prod → ${targetDir}`);
  run(`pnpm --filter @nexus/api deploy --prod "${targetDir}"`);
  for (const name of [".env", ".env.local"]) {
    rmSync(resolve(targetDir, name), { force: true });
  }
  copyPrismaClientToRuntime(targetDir);
  run(`node scripts/prune-api-runtime.mjs "${targetDir}"`);
  run(`node scripts/bundle-serverless.mjs "${targetDir}"`);
  const entry = resolve(targetDir, "dist/serverless.bundle.js");
  if (!existsSync(entry)) {
    console.error(`[vercel-prepare] Missing ${entry}`);
    process.exit(1);
  }
  if (!existsSync(resolve(targetDir, "node_modules/.prisma/client/index.js"))) {
    console.error("[vercel-prepare] Prisma client missing after prune");
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

const rootRuntime = resolve(monorepoRoot, "api/runtime");
const webRuntime = resolve(monorepoRoot, "packages/web/api/runtime");

run("node scripts/deploy-auth-lite.mjs");
const webAuthLite = resolve(monorepoRoot, "packages/web/api/auth-lite");
cpSync(webAuthLite, resolve(monorepoRoot, "api/auth-lite"), { recursive: true });
deployApiRuntime(rootRuntime);
rmSync(webRuntime, { recursive: true, force: true });
mkdirSync(dirname(webRuntime), { recursive: true });
cpSync(rootRuntime, webRuntime, { recursive: true });
console.log(`[vercel-prepare] API runtime → ${webRuntime}`);

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
  resolve(monorepoRoot, "packages/web/api/auth.js"),
  resolve(monorepoRoot, "packages/web/api/auth-lite/node_modules/bcryptjs/package.json"),
  resolve(webRuntime, "dist/serverless.bundle.js"),
  resolve(webRuntime, "node_modules/@nestjs/common/package.json"),
  resolve(webRuntime, "node_modules/.prisma/client/index.js"),
  resolve(
    webRuntime,
    "node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
  ),
];

for (const file of mustExist) {
  if (!existsSync(file)) {
    console.error(`[vercel-prepare] Required output missing: ${file}`);
    process.exit(1);
  }
}

console.log("[vercel-prepare] Done — static + api/runtime ready for Vercel");
