#!/usr/bin/env node
/**
 * Regenerates PNG PWA icons from public/icon.svg (macOS `sips`).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = join(publicDir, "icon.svg");
const png512 = join(publicDir, "icon-512.png");
const png192 = join(publicDir, "icon-192.png");

try {
  execFileSync("sips", ["-s", "format", "png", svg, "--out", png512], { stdio: "inherit" });
  execFileSync("sips", ["-z", "512", "512", png512], { stdio: "inherit" });
  execFileSync("sips", ["-z", "192", "192", png512, "--out", png192], { stdio: "inherit" });
  console.log("Wrote icon-512.png and icon-192.png");
} catch (err) {
  console.error("generate-pwa-icons: `sips` failed (macOS only). Commit the PNGs or run on a Mac.");
  process.exit(err.status ?? 1);
}
