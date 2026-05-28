import type { INestApplication } from "@nestjs/common";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ensureDatabaseUrl } from "./ensure-database";

const logger = new Logger("Bootstrap");

export async function createNestApplication(): Promise<INestApplication> {
  if (process.env.VERCEL) logger.warn("bootstrap:start");
  await ensureDatabaseUrl();
  if (process.env.VERCEL) logger.warn("bootstrap:database-ready");

  const app = await NestFactory.create(AppModule, {
    logger: process.env.VERCEL ? ["error", "warn"] : undefined,
  });
  if (process.env.VERCEL) logger.warn("bootstrap:nest-created");

  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api");
  await app.init();
  if (process.env.VERCEL) logger.warn("bootstrap:app-init-done");
  return app;
}
