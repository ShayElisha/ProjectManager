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

function pathOnly(url) {
  return (url || "").split("?")[0];
}

function verifyBearer(req) {
  const raw = req.headers.authorization || req.headers.Authorization || "";
  const token = String(raw).startsWith("Bearer ") ? String(raw).slice(7) : "";
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function iso(d) {
  if (!d) return undefined;
  return d instanceof Date ? d.toISOString() : String(d);
}

function mapProject(doc) {
  return {
    id: doc._id?.toString?.() ?? String(doc._id),
    organizationId: doc.organizationId,
    parentId: doc.parentId ?? null,
    isTemplate: !!doc.isTemplate,
    name: doc.name,
    description: doc.description ?? undefined,
    locale: doc.locale ?? "he",
    currency: doc.currency ?? "ILS",
    startDate: doc.startDate,
    endDate: doc.endDate ?? undefined,
    status: doc.status ?? "active",
    budgetCap: doc.budgetCap ?? undefined,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

function mapOrganization(doc) {
  return {
    id: doc._id?.toString?.() ?? String(doc._id),
    name: doc.name,
    defaultLocale: doc.defaultLocale ?? "he",
    defaultCurrency: doc.defaultCurrency ?? "ILS",
  };
}

async function handleMe(payload) {
  return {
    status: 200,
    body: {
      id: payload.sub,
      email: payload.email,
      name: payload.email?.includes("@") ? payload.email.split("@")[0] : "User",
      role: payload.role || "team_member",
      organizationId: payload.organizationId,
    },
  };
}

async function handleOrganizations(payload) {
  const rows = await withMongo((db) => {
    const q = payload.organizationId
      ? { _id: payload.organizationId }
      : {};
    return db.collection("Organization").find(q).toArray();
  });
  if (rows === null) {
    return {
      status: 200,
      body: payload.organizationId
        ? [{ id: payload.organizationId, name: "Organization", defaultLocale: "he", defaultCurrency: "ILS" }]
        : [],
    };
  }
  return { status: 200, body: rows.map(mapOrganization) };
}

async function handleProjects(payload, url) {
  const qs = new URL(url, "http://localhost");
  const orgId = qs.searchParams.get("organizationId") || payload.organizationId;
  const parentId = qs.searchParams.get("parentId");
  const isTemplate = qs.searchParams.get("isTemplate");
  const rows = await withMongo((db) => {
    const filter = {};
    if (orgId) filter.organizationId = orgId;
    if (parentId !== null && parentId !== undefined && parentId !== "") {
      filter.parentId = parentId === "null" ? null : parentId;
    }
    if (isTemplate !== null && isTemplate !== undefined && isTemplate !== "") {
      filter.isTemplate = isTemplate === "true";
    }
    return db.collection("Project").find(filter).toArray();
  });
  if (rows === null) return { status: 200, body: [] };
  return { status: 200, body: rows.map(mapProject) };
}

async function handleProjectById(payload, projectId) {
  const doc = await withMongo((db) => db.collection("Project").findOne({ _id: projectId }));
  if (!doc) return { status: 404, body: { statusCode: 404, message: "Not Found" } };
  if (payload.organizationId && doc.organizationId !== payload.organizationId) {
    return { status: 403, body: { statusCode: 403, message: "Forbidden" } };
  }
  return { status: 200, body: mapProject(doc) };
}

async function handleLiteGet(req) {
  const payload = verifyBearer(req);
  if (!payload) return { status: 401, body: { statusCode: 401, message: "Unauthorized" } };
  const path = pathOnly(req.url);
  if (path.endsWith("/auth/me")) return handleMe(payload);
  if (path.endsWith("/organizations")) return handleOrganizations(payload);
  if (path === "/api/projects" || path.endsWith("/projects")) return handleProjects(payload, req.url);
  const m = path.match(/\/projects\/([^/]+)$/);
  if (m) return handleProjectById(payload, m[1]);
  return { status: 404, body: { statusCode: 404, message: "Not Found" } };
}

function send(res, result) {
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(result.body));
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      return send(res, await handleLiteGet(req));
    }
    if (req.method !== "POST") {
      return send(res, { status: 405, body: { statusCode: 405, message: "Method Not Allowed" } });
    }
    const action = routeAction(req.url);
    if (!action) {
      return send(res, { status: 404, body: { statusCode: 404, message: "Not Found" } });
    }
    const body = await readBody(req);
    const result = action === "login" ? await handleLogin(body) : await handleRegister(body);
    return send(res, result);
  } catch (err) {
    return send(res, {
      status: 500,
      body: {
        statusCode: 500,
        message: err instanceof Error ? err.message : "Internal Server Error",
      },
    });
  }
};

module.exports.config = { maxDuration: 30, memory: 256 };
