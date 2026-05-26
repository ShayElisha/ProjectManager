import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const webDist = resolve(cwd, "packages/web/dist");
const localDist = resolve(cwd, "dist");

const source = existsSync(webDist) ? webDist : existsSync(localDist) ? localDist : null;

if (!source) {
  console.error(
    "[vercel-sync-dist] No frontend build output found.",
    "Expected packages/web/dist (monorepo root) or dist (packages/web root).",
  );
  process.exit(1);
}

if (source !== localDist) {
  rmSync(localDist, { recursive: true, force: true });
  cpSync(source, localDist, { recursive: true });
  console.log(`[vercel-sync-dist] Copied ${source} → ${localDist}`);
} else {
  console.log(`[vercel-sync-dist] Using ${localDist}`);
}
