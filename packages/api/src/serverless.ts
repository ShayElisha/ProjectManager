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

type ServerlessHandler = (
  req: Parameters<ReturnType<typeof serverless>>[0],
  res: Parameters<ReturnType<typeof serverless>>[1],
) => ReturnType<ReturnType<typeof serverless>>;

let cached: ServerlessHandler | null = null;

async function getHandler(): Promise<ServerlessHandler> {
  if (cached) return cached;
  const app = await createNestApplication();
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(vercelApiPathFix);
  cached = serverless(expressApp, {
    binary: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
      "image/*",
    ],
  });
  return cached;
}

export default async function handler(req: unknown, res: unknown) {
  const fn = await getHandler();
  return fn(req as never, res as never);
}

export const config = {
  maxDuration: 60,
  memory: 1024,
};
