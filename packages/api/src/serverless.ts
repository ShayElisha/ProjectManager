import type { NextFunction, Request, Response } from "express";
import serverless from "serverless-http";
import { createNestApplication } from "./bootstrap";

/** Vercel rewrites /api/* to /api/index; Express may see paths without the /api prefix. */
function vercelApiPathFix(req: Request, _res: Response, next: NextFunction): void {
  if (!process.env.VERCEL) {
    next();
    return;
  }
  const raw = req.url ?? "/";
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  const path = raw.split("?")[0] || "/";
  if (!path.startsWith("/api")) {
    req.url = `/api${path === "/" ? "" : path}${q}`;
  }
  next();
}

type ExpressHandler = (req: Request, res: Response, next?: NextFunction) => unknown;

let cached: ExpressHandler | null = null;
let booting: Promise<ExpressHandler> | null = null;

const BOOTSTRAP_MS = process.env.VERCEL ? 25_000 : 120_000;

async function getHandler(): Promise<ExpressHandler> {
  if (cached) return cached;
  if (booting) return booting;
  booting = (async () => {
    const app = await Promise.race([
      createNestApplication(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("API bootstrap timed out")), BOOTSTRAP_MS);
      }),
    ]);
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(vercelApiPathFix);
    const handler = serverless(expressApp, {
      binary: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
        "image/*",
      ],
    }) as ExpressHandler;
    return handler;
  })();
  try {
    cached = await booting;
    return cached;
  } finally {
    booting = null;
  }
}

export default async function handler(req: unknown, res: unknown) {
  try {
    const fn = await getHandler();
    return fn(req as Request, res as Response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server failed to start";
    const resObj = res as Response;
    if (typeof resObj.status === "function") {
      resObj.status(503).json({
        statusCode: 503,
        message,
        hint: "Check Vercel env: DATABASE_URL (MongoDB Atlas), JWT_SECRET. See API logs.",
      });
      return;
    }
    throw err;
  }
}

export const config = {
  maxDuration: 60,
  memory: 1024,
};
