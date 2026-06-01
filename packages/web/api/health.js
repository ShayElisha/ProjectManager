"use strict";

/** Lightweight health check — no NestJS (fast on Vercel cold start). */
module.exports = (_req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, ts: Date.now(), service: "corePilot-api" }));
};

module.exports.config = { maxDuration: 10, memory: 128 };
