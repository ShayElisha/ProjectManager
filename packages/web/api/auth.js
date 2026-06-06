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
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
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
  const rows = await withMongo(async (db) => {
    const allowedIds = await userAccessibleProjectIds(db, payload);
    if (allowedIds.length === 0) return [];

    const filter = { _id: { $in: allowedIds } };
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
  const doc = await withMongo(async (db) => {
    const allowedIds = await userAccessibleProjectIds(db, payload);
    if (!allowedIds.includes(String(projectId))) return null;
    return db.collection("Project").findOne({ _id: projectId });
  });
  if (!doc) return { status: 404, body: { statusCode: 404, message: "Not Found" } };
  if (payload.organizationId && doc.organizationId !== payload.organizationId) {
    return { status: 403, body: { statusCode: 403, message: "Forbidden" } };
  }
  return { status: 200, body: mapProject(doc) };
}

async function userAccessibleProjectIds(db, payload) {
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const orgId = payload.organizationId;
  if (!email) return [];

  const resFilter = {};
  if (orgId) resFilter.organizationId = orgId;
  resFilter.email = email;
  const resources = await db.collection("Resource").find(resFilter).toArray();
  const resourceIds = resources.map((r) => r._id?.toString?.() ?? String(r._id));
  if (resourceIds.length === 0) return [];

  const projectIdSet = new Set();
  const members = await db
    .collection("ProjectMember")
    .find({ resourceId: { $in: resourceIds } })
    .toArray();
  for (const m of members) {
    if (m.projectId) projectIdSet.add(String(m.projectId));
  }

  const assigned = await db
    .collection("Task")
    .find({ assigneeIds: { $in: resourceIds } })
    .project({ projectId: 1 })
    .toArray();
  for (const t of assigned) {
    if (t.projectId) projectIdSet.add(String(t.projectId));
  }

  return [...projectIdSet];
}

function emptyOrgRollup() {
  return {
    totalPv: 0,
    totalEv: 0,
    totalAc: 0,
    totalEac: 0,
    totalVac: 0,
    totalCv: 0,
    totalSv: 0,
    totalBudgetCap: 0,
    avgPercentBudgetUsed: null,
    openRisks: 0,
    highRisks: 0,
    pendingChangeRequests: 0,
    pendingChangeImpactDays: 0,
    pendingChangeImpactCost: 0,
    pendingTimesheets: 0,
    pendingTimesheetHours: 0,
    totalCriticalTasks: 0,
    onTimeProjects: 0,
    delayedProjects: 0,
    resourceConflictCount: 0,
    projectsByStatus: { planning: 0, active: 0, on_hold: 0, completed: 0 },
    budgetByCategory: [],
  };
}

function emptyExecutiveBody(orgId = "", orgName = "") {
  return {
    organizationId: orgId,
    organizationName: orgName,
    projects: [],
    resourceConflicts: [],
    generatedAt: new Date().toISOString(),
    counts: { on_track: 0, at_risk: 0, critical: 0 },
    rollup: emptyOrgRollup(),
  };
}

async function handlePortfolioExecutive(payload) {
  const orgId = payload.organizationId;
  const built = await withMongo(async (db) => {
    const allowedIds = await userAccessibleProjectIds(db, payload);
    if (allowedIds.length === 0) {
      return emptyExecutiveBody(orgId);
    }

    const org = orgId
      ? await db.collection("Organization").findOne({ _id: orgId })
      : await db.collection("Organization").findOne({});
    const resolvedOrgId = org?._id?.toString?.() ?? orgId ?? "";
    const orgName = org?.name ?? "Organization";

    const filter = {
      _id: { $in: allowedIds },
      isTemplate: { $ne: true },
    };
    if (resolvedOrgId) filter.organizationId = resolvedOrgId;
    const projects = await db.collection("Project").find(filter).toArray();
    const projectIds = projects.map((p) => p._id?.toString?.() ?? String(p._id));

    const taskStats = new Map();
    if (projectIds.length > 0) {
      const stats = await db
        .collection("Task")
        .aggregate([
          { $match: { projectId: { $in: projectIds }, isSummary: { $ne: true } } },
          {
            $group: {
              _id: "$projectId",
              count: { $sum: 1 },
              avgComplete: { $avg: "$percentComplete" },
              criticalCount: { $sum: { $cond: [{ $eq: ["$isCritical", true] }, 1, 0] } },
            },
          },
        ])
        .toArray();
      for (const s of stats) taskStats.set(s._id, s);
    }

    const summaries = projects.map((doc) => {
      const id = doc._id?.toString?.() ?? String(doc._id);
      const ts = taskStats.get(id) ?? { count: 0, avgComplete: 0, criticalCount: 0 };
      return {
        ...mapProject(doc),
        taskCount: ts.count,
        percentComplete: Math.round(ts.avgComplete || 0),
        plannedBudget: 0,
        actualCost: 0,
        criticalCount: ts.criticalCount || 0,
        health: "on_track",
        scheduleVarianceDays: 0,
        budgetVariance: null,
        forecastDelayDays: 0,
        cpi: 1,
        spi: 1,
        lateTaskCount: 0,
        pv: 0,
        ev: 0,
        eac: 0,
        vac: 0,
        percentBudgetUsed: null,
      };
    });

    const counts = { on_track: 0, at_risk: 0, critical: 0 };
    const rollup = emptyOrgRollup();
    for (const p of summaries) {
      counts[p.health]++;
      rollup.projectsByStatus[p.status]++;
      rollup.onTimeProjects++;
      rollup.totalCriticalTasks += p.criticalCount;
    }

    return {
      organizationId: resolvedOrgId,
      organizationName: orgName,
      projects: summaries,
      resourceConflicts: [],
      generatedAt: new Date().toISOString(),
      counts,
      rollup,
    };
  });

  return { status: 200, body: built ?? emptyExecutiveBody(orgId) };
}

async function handleRejections(payload, url) {
  const qs = new URL(url, "http://localhost");
  const projectId = qs.searchParams.get("projectId");
  const rows = await withMongo(async (db) => {
    const allowedIds = await userAccessibleProjectIds(db, payload);
    if (allowedIds.length === 0) return [];

    const filter = {};
    if (projectId) {
      if (!allowedIds.includes(String(projectId))) return [];
      filter.projectId = projectId;
    } else {
      filter.projectId = { $in: allowedIds };
    }

    const names = new Map();
    const projs = await db
      .collection("Project")
      .find(
        projectId ? { _id: projectId } : { _id: { $in: allowedIds } },
      )
      .project({ _id: 1, name: 1 })
      .toArray();
    for (const p of projs) names.set(p._id?.toString?.() ?? String(p._id), p.name ?? "");
    const logs = await db
      .collection("RejectionLog")
      .find(filter)
      .sort({ rejectedAt: -1 })
      .limit(200)
      .toArray();
    return logs.map((r) => ({
      id: r._id?.toString?.() ?? String(r._id),
      kind: "manual",
      projectId: r.projectId,
      projectName: names.get(r.projectId) ?? "",
      title: r.title,
      detail: r.description ?? undefined,
      rejectedAt: r.rejectedAt,
      decisionNote: r.decisionNote ?? undefined,
      impactScheduleDays: r.impactScheduleDays ?? undefined,
      impactCost: r.impactCost ?? undefined,
      taskId: r.taskId ?? undefined,
    }));
  });
  return { status: 200, body: rows ?? [] };
}

function isPublicAuthPath(path) {
  return path.endsWith("/auth/login") || path.endsWith("/auth/register");
}

async function handleLiteGet(req) {
  const path = pathOnly(req.url);
  if (isPublicAuthPath(path)) {
    return { status: 405, body: { statusCode: 405, message: "Method Not Allowed" } };
  }
  const payload = verifyBearer(req);
  if (!payload) return { status: 401, body: { statusCode: 401, message: "Unauthorized" } };
  if (path.endsWith("/auth/me")) return handleMe(payload);
  if (path.endsWith("/organizations")) return handleOrganizations(payload);
  if (path.endsWith("/portfolio/executive")) return handlePortfolioExecutive(payload);
  if (path === "/api/rejections" || path.endsWith("/rejections")) return handleRejections(payload, req.url);
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
