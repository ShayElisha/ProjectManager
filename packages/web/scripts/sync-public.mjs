import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(webRoot, "dist");
const pub = resolve(webRoot, "public");

if (!existsSync(resolve(dist, "index.html"))) {
  console.error("[sync-public] dist/index.html missing — run vite build first.");
  process.exit(1);
}

rmSync(pub, { recursive: true, force: true });
cpSync(dist, pub, { recursive: true });
console.log(`[sync-public] ${dist} → ${pub}`);
