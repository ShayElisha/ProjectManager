#!/usr/bin/env node
/**
 * Disables all Vercel Deployment Protection on a project (SSO, password, trusted IPs).
 * Requires: vercel login
 *
 * Usage:
 *   node scripts/vercel-disable-deployment-protection.mjs [projectName]
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const projectName = process.argv[2] || "core-pilote";
const teamId =
  process.env.VERCEL_TEAM_ID || "team_HjXIodOdqSakV7JkdZEfIlep";

const authPaths = [
  join(homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
  join(homedir(), ".local/share/com.vercel.cli/auth.json"),
  join(homedir(), ".config/com.vercel.cli/auth.json"),
];

let token = process.env.VERCEL_TOKEN || "";
if (!token) {
  for (const p of authPaths) {
    try {
      token = JSON.parse(readFileSync(p, "utf8")).token || "";
      if (token) break;
    } catch {
      /* try next */
    }
  }
}

if (!token) {
  console.error("No Vercel token. Run: vercel login");
  process.exit(1);
}

const patch = {
  ssoProtection: null,
  passwordProtection: null,
  trustedIps: null,
};

const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}?teamId=${teamId}`;
const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(patch),
});

const body = await res.json();
if (!res.ok) {
  console.error(body);
  process.exit(1);
}

console.log(`OK: ${body.name}`, {
  ssoProtection: body.ssoProtection,
  passwordProtection: body.passwordProtection,
  trustedIps: body.trustedIps,
});
