/** Shared Vercel /api entry — resolves monorepo node_modules before loading Nest. */
const path = require("node:path");
const fs = require("node:fs");

function patchModulePaths() {
  let dir = __dirname;
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const roots = [
      path.join(dir, "node_modules"),
      path.join(dir, "packages", "api", "node_modules"),
    ];
    for (const nm of roots) {
      if (fs.existsSync(nm) && !seen.has(nm)) {
        seen.add(nm);
        module.paths.unshift(nm);
      }
    }
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

patchModulePaths();

const mod = require("@nexus/api/dist/serverless.js");

module.exports = mod.default ?? mod;
module.exports.config = mod.config ?? { maxDuration: 60, memory: 1024 };
