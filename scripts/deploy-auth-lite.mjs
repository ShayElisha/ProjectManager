#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = resolve(monorepoRoot, "packages/web/api/auth-lite");

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

writeFileSync(
  resolve(targetDir, "package.json"),
  JSON.stringify(
    {
      name: "auth-lite",
      private: true,
      dependencies: {
        bcryptjs: "3.0.3",
        jsonwebtoken: "9.0.2",
        mongodb: "7.2.0",
      },
    },
    null,
    2,
  ),
);

execSync("npm install --omit=dev --no-package-lock", {
  cwd: targetDir,
  stdio: "inherit",
});

for (const pkg of ["bcryptjs", "jsonwebtoken", "mongodb"]) {
  if (!existsSync(resolve(targetDir, "node_modules", pkg, "package.json"))) {
    console.error(`[deploy-auth-lite] missing ${pkg}`);
    process.exit(1);
  }
}

console.log(`[deploy-auth-lite] OK → ${targetDir}`);
