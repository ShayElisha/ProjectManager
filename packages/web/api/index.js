"use strict";

const path = require("node:path");
const fs = require("node:fs");

function resolveServerlessEntry() {
  const candidates = [
    path.join(__dirname, "runtime", "dist", "serverless.js"),
    path.join(__dirname, "..", "..", "..", "api", "runtime", "dist", "serverless.js"),
    path.join(__dirname, "..", "..", "api", "dist", "serverless.js"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  throw new Error(
    "API runtime missing. Run: pnpm run build:vercel (creates packages/web/api/runtime)",
  );
}

const mod = require(resolveServerlessEntry());

module.exports = mod.default ?? mod;
module.exports.config = mod.config ?? { maxDuration: 60, memory: 1024 };
