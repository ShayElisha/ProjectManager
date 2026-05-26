import serverless from "serverless-http";
import { createNestApplication } from "./bootstrap";

type ServerlessHandler = (
  req: Parameters<ReturnType<typeof serverless>>[0],
  res: Parameters<ReturnType<typeof serverless>>[1],
) => ReturnType<ReturnType<typeof serverless>>;

let cached: ServerlessHandler | null = null;

async function getHandler(): Promise<ServerlessHandler> {
  if (cached) return cached;
  const app = await createNestApplication();
  const expressApp = app.getHttpAdapter().getInstance();
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
