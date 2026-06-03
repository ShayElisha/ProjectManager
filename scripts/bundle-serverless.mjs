#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeDir = process.argv[2];
if (!runtimeDir) {
  console.error("Usage: node scripts/bundle-serverless.mjs <runtimeDir>");
  process.exit(1);
}

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(runtimeDir, "dist/serverless.js");
const outfile = resolve(runtimeDir, "dist/serverless.bundle.js");

if (!existsSync(entry)) {
  console.error(`[bundle-serverless] Missing ${entry}`);
  process.exit(1);
}

execSync(
  `npx --yes esbuild@0.25.9 "${entry}" --bundle --platform=node --target=node20 --packages=external --outfile="${outfile}" --log-level=warning`,
  { cwd: monorepoRoot, stdio: "inherit" },
);

if (!existsSync(outfile)) {
  console.error(`[bundle-serverless] Missing output ${outfile}`);
  process.exit(1);
}

console.log(`[bundle-serverless] OK → ${outfile}`);
