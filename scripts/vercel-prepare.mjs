import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(scriptDir, "..");
const cwd = process.cwd();

function findWebBuildOutput() {
  const candidates = [
    resolve(monorepoRoot, "packages/web/dist"),
    resolve(monorepoRoot, "dist"),
    resolve(cwd, "dist"),
  ];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, "index.html"))) return dir;
  }
  return null;
}

const webBuilt = findWebBuildOutput();
if (!webBuilt) {
  console.error(
    "[vercel-prepare] No frontend build found.",
    "Checked:",
    resolve(monorepoRoot, "packages/web/dist"),
    resolve(monorepoRoot, "dist"),
    resolve(cwd, "dist"),
  );
  process.exit(1);
}

const apiDist = resolve(monorepoRoot, "packages/api/dist");
const apiPrisma = resolve(monorepoRoot, "packages/api/prisma");

if (!existsSync(apiDist)) {
  console.error("[vercel-prepare] Missing packages/api/dist — run build:vercel first.");
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

function mirrorWebDist(targetDir) {
  const target = resolve(targetDir);
  const source = resolve(webBuilt);
  if (target === source) {
    console.log(`[vercel-prepare] Web dist OK at ${target}`);
    return;
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[vercel-prepare] Web dist → ${target}`);
}

bundleApiForHandler(resolve(monorepoRoot, "api"));
bundleApiForHandler(resolve(monorepoRoot, "packages/web/api"));

const outputDirs = [
  resolve(monorepoRoot, "packages/web/dist"),
  resolve(monorepoRoot, "dist"),
  resolve(monorepoRoot, "public"),
  resolve(monorepoRoot, "packages/web/public"),
  resolve(cwd, "dist"),
  resolve(cwd, "public"),
];

for (const dir of outputDirs) {
  mirrorWebDist(dir);
}

const verified = outputDirs.filter((d) => existsSync(resolve(d, "index.html")));
console.log(`[vercel-prepare] index.html present in ${verified.length} output dir(s)`);
