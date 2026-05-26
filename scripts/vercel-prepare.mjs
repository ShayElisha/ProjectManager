import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
    resolve(cwd, "public"),
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

function bundleApiForHandler(apiDir) {
  const nestDir = resolve(apiDir, "nest");
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

function writeBuildOutputApi(outputRoot) {
  const root = resolve(outputRoot);
  const staticDir = resolve(root, "static");
  const apiFuncDir = resolve(root, "functions/api.func");

  rmSync(root, { recursive: true, force: true });
  mkdirSync(staticDir, { recursive: true });
  cpSync(webBuilt, staticDir, { recursive: true });

  mkdirSync(apiFuncDir, { recursive: true });
  cpSync(apiDist, resolve(apiFuncDir, "nest"), { recursive: true });
  cpSync(apiPrisma, resolve(apiFuncDir, "nest/prisma"), { recursive: true });

  writeFileSync(
    resolve(apiFuncDir, "index.js"),
    `'use strict';
const mod = require('./nest/serverless.js');
module.exports = mod.default;
`,
  );

  writeFileSync(
    resolve(apiFuncDir, ".vc-config.json"),
    `${JSON.stringify(
      {
        runtime: "nodejs20.x",
        handler: "index",
        launcherType: "Nodejs",
        maxDuration: 60,
        memory: 1024,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    resolve(root, "config.json"),
    `${JSON.stringify(
      {
        version: 3,
        routes: [
          { src: "/api/(.*)", dest: "/api" },
          { handle: "filesystem" },
          { src: "/(.*)", dest: "/index.html" },
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`[vercel-prepare] Build Output API → ${root}`);
}

bundleApiForHandler(resolve(monorepoRoot, "api"));
bundleApiForHandler(resolve(monorepoRoot, "packages/web/api"));

const staticTargets = [
  resolve(monorepoRoot, "packages/web/dist"),
  resolve(monorepoRoot, "packages/web/public"),
  resolve(monorepoRoot, "public"),
  resolve(monorepoRoot, "dist"),
  resolve(cwd, "dist"),
  resolve(cwd, "public"),
];

for (const dir of staticTargets) {
  mirrorStatic(dir);
}

for (const out of [
  resolve(monorepoRoot, ".vercel/output"),
  resolve(monorepoRoot, "packages/web/.vercel/output"),
  resolve(cwd, ".vercel/output"),
]) {
  writeBuildOutputApi(out);
}

const mustExist = [
  resolve(monorepoRoot, "packages/web/public/index.html"),
  resolve(monorepoRoot, "public/index.html"),
];

for (const file of mustExist) {
  if (!existsSync(file)) {
    console.error(`[vercel-prepare] Required output missing: ${file}`);
    process.exit(1);
  }
}

console.log("[vercel-prepare] Done — public/, dist/, api/nest, .vercel/output ready");
