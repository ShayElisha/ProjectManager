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

/** @param {string} outputRoot */
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

const outputTargets = new Set([
  resolve(monorepoRoot, ".vercel/output"),
  resolve(monorepoRoot, "packages/web/.vercel/output"),
  resolve(cwd, ".vercel/output"),
]);

for (const target of outputTargets) {
  writeBuildOutputApi(target);
}
