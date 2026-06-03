#!/usr/bin/env node
/**
 * Shrinks pnpm deploy output for Vercel serverless (250 MB unzipped limit).
 */
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const runtimeDir = process.argv[2];
if (!runtimeDir) {
  console.error("Usage: node scripts/prune-api-runtime.mjs <runtimeDir>");
  process.exit(1);
}

const nm = join(runtimeDir, "node_modules");

function rm(target, label) {
  if (!existsSync(target)) return;
  rmSync(target, { recursive: true, force: true });
  console.log(`[prune-api-runtime] removed ${label}`);
}

/** Remove packages never needed at runtime on Vercel. */
const dropPackages = [
  "prisma",
  "typescript",
  "effect",
  "@nestjs/cli",
  "@nestjs/schematics",
  "webpack",
  "@angular-devkit",
  "@turbo",
  "mongodb-memory-server",
  "socket.io",
  "@nestjs/platform-socket.io",
  "@nestjs/websockets",
  "fast-check",
  "jiti",
  "terser",
  "caniuse-lite",
  "fork-ts-checker-webpack-plugin",
  "libphonenumber-js",
];

for (const pkg of dropPackages) {
  rm(join(nm, pkg), pkg);
}

/** Drop all @types/* (not needed at runtime). */
if (existsSync(join(nm, "@types"))) {
  rm(join(nm, "@types"), "@types/*");
}

/** Keep only Linux query engine binaries for Vercel. */
function prunePrismaEngines(dir, label) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (
      name.includes("darwin") ||
      name.includes("windows") ||
      name.startsWith("schema-engine-")
    ) {
      rm(join(dir, name), `${label}/${name}`);
    }
  }
}

rm(join(nm, "@prisma/engines"), "@prisma/engines");
rm(join(nm, "@prisma/fetch-engine"), "@prisma/fetch-engine");
rm(join(nm, "@prisma/get-platform"), "@prisma/get-platform");
prunePrismaEngines(join(nm, ".prisma/client"), ".prisma/client");

/** MongoDB uses the native query engine; drop other DB wasm bundles (~60MB). */
const prismaRuntime = join(nm, "@prisma/client/runtime");
if (existsSync(prismaRuntime)) {
  for (const name of readdirSync(prismaRuntime)) {
    if (
      name.includes("wasm") ||
      /cockroachdb|postgresql|mysql|sqlite|sqlserver/.test(name)
    ) {
      rm(join(prismaRuntime, name), `@prisma/client/runtime/${name}`);
    }
  }
}

rm(join(runtimeDir, "data"), "data");

/** Remove dev-only scripts from deployed package.json surface. */
const pkgPath = join(runtimeDir, "package.json");
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  delete pkg.devDependencies;
  delete pkg.scripts?.["db:migrate"];
  delete pkg.scripts?.dev;
  delete pkg.scripts?.typecheck;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function dirSize(path) {
  if (!existsSync(path)) return 0;
  let total = 0;
  for (const name of readdirSync(path)) {
    const p = join(path, name);
    try {
      const st = statSync(p);
      total += st.isDirectory() ? dirSize(p) : st.size;
    } catch {
      /* broken symlinks under node_modules/.bin after prune */
    }
  }
  return total;
}

const mb = (dirSize(runtimeDir) / 1024 / 1024).toFixed(1);
console.log(`[prune-api-runtime] runtime size ≈ ${mb} MB`);
