"use strict";

const AUTH_SUFFIXES = ["/api/auth/login", "/api/auth/register", "/auth/login", "/auth/register"];

function isAuthRoute(url) {
  const path = (url || "").split("?")[0];
  return AUTH_SUFFIXES.some((suffix) => path === suffix || path.endsWith(suffix));
}

let authHandler;
let nestHandler;

async function handler(req, res) {
  if (isAuthRoute(req.url)) {
    authHandler ??= require("./auth.js");
    return authHandler(req, res);
  }
  if (!nestHandler) nestHandler = require("../packages/web/api/index.js");
  return nestHandler(req, res);
}

module.exports = handler;

module.exports.config = { maxDuration: 300, memory: 1024 };
