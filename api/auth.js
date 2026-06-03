"use strict";

const bcrypt = require("./auth-lite/node_modules/bcryptjs");
const jwt = require("./auth-lite/node_modules/jsonwebtoken");
const { MongoClient } = require("./auth-lite/node_modules/mongodb");

const JWT_SECRET = process.env.JWT_SECRET || "nexus-dev-secret-change-in-production";
const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@nexus.local").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin1234";

let adminHashPromise = null;

function adminPasswordHash() {
  if (!adminHashPromise) adminHashPromise = bcrypt.hash(ADMIN_PASSWORD, 10);
  return adminHashPromise;
}

function isAtlasUrl(url) {
  return url.includes("mongodb+srv://") || url.includes("mongodb.net");
}

function dbNameFromUrl(url) {
  const slash = url.lastIndexOf("/");
  if (slash === -1) return "nexus_project";
  const segment = url.slice(slash + 1).split("?")[0];
  return segment || "nexus_project";
}

async function withMongo(fn) {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!url || !isAtlasUrl(url)) return null;
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const db = client.db(dbNameFromUrl(url));
    return await fn(db);
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function findUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const fromDb = await withMongo((db) => db.collection("User").findOne({ email: normalized }));
  if (fromDb) {
    return {
      id: fromDb._id?.toString?.() ?? String(fromDb._id),
      email: fromDb.email,
      name: fromDb.name,
      role: fromDb.role || "team_member",
      organizationId: fromDb.organizationId ?? undefined,
      passwordHash: fromDb.passwordHash,
      totpEnabled: !!fromDb.totpEnabled,
      totpSecret: fromDb.totpSecret ?? undefined,
    };
  }
  if (normalized === ADMIN_EMAIL) {
    return {
      id: "bootstrap-admin",
      email: ADMIN_EMAIL,
      name: "Admin",
      role: "admin",
      organizationId: "bootstrap-org",
      passwordHash: await adminPasswordHash(),
      totpEnabled: false,
    };
  }
  return null;
}

function signToken(user) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
  const { passwordHash: _p, totpSecret: _s, ...publicUser } = user;
  return { accessToken, user: publicUser };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function routeAction(url) {
  const path = (url || "").split("?")[0];
  if (path.endsWith("/login")) return "login";
  if (path.endsWith("/register")) return "register";
  return null;
}

async function handleLogin(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const totpCode = body.totpCode;
  if (!email || !password) {
    return { status: 400, body: { statusCode: 400, message: "Bad Request" } };
  }
  const record = await findUserByEmail(email);
  if (!record || !(await bcrypt.compare(password, record.passwordHash))) {
    return { status: 401, body: { statusCode: 401, message: "INVALID_CREDENTIALS" } };
  }
  if (record.totpEnabled) {
    if (!totpCode) {
      const { passwordHash: _p, totpSecret: _s, ...user } = record;
      return { status: 200, body: { accessToken: "", user, requiresTotp: true } };
    }
    return { status: 401, body: { statusCode: 401, message: "INVALID_TOTP" } };
  }
  return { status: 200, body: signToken(record) };
}

async function handleRegister(body) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!name || !email || !password || password.length < 6) {
    return { status: 400, body: { statusCode: 400, message: "Bad Request" } };
  }
  const existing = await findUserByEmail(email);
  if (existing) {
    return { status: 409, body: { statusCode: 409, message: "EMAIL_EXISTS" } };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();
  let organizationId = body.organizationId;

  const created = await withMongo(async (db) => {
    if (!organizationId) {
      const org = await db.collection("Organization").findOne({});
      organizationId = org?._id?.toString?.() ?? org?._id ?? crypto.randomUUID();
      if (!org) {
        await db.collection("Organization").insertOne({
          _id: organizationId,
          name: "Organization",
          defaultLocale: "he",
          defaultCurrency: "ILS",
        });
      }
    }
    await db.collection("User").insertOne({
      _id: id,
      email,
      name,
      passwordHash,
      role: "team_member",
      organizationId,
      totpEnabled: false,
      createdAt: new Date(),
    });
    return true;
  });

  if (!created) {
    return {
      status: 503,
      body: {
        statusCode: 503,
        message: "DATABASE_UNAVAILABLE",
        hint: "Set DATABASE_URL (MongoDB Atlas) on Vercel for registration.",
      },
    };
  }

  return {
    status: 200,
    body: signToken({
      id,
      email,
      name,
      role: "team_member",
      organizationId,
      passwordHash,
      totpEnabled: false,
    }),
  };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ statusCode: 405, message: "Method Not Allowed" }));
      return;
    }
    const action = routeAction(req.url);
    if (!action) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ statusCode: 404, message: "Not Found" }));
      return;
    }
    const body = await readBody(req);
    const result = action === "login" ? await handleLogin(body) : await handleRegister(body);
    res.statusCode = result.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result.body));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        statusCode: 500,
        message: err instanceof Error ? err.message : "Internal Server Error",
      }),
    );
  }
};

module.exports.config = { maxDuration: 15, memory: 256 };
