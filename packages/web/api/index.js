"use strict";

const path = require("node:path");
const fs = require("node:fs");

function resolveServerlessEntry() {
  const candidates = [
    path.join(__dirname, "runtime", "dist", "serverless.bundle.js"),
    path.join(__dirname, "..", "..", "..", "api", "runtime", "dist", "serverless.bundle.js"),
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

let nestHandler;

async function handler(req, res) {
  if (!nestHandler) {
    const mod = require(resolveServerlessEntry());
    nestHandler = mod.default ?? mod;
  }
  return nestHandler(req, res);
}

module.exports = handler;
module.exports.config = { maxDuration: 300, memory: 1024 };
