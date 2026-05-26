import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ensureDatabaseUrl } from "./ensure-database";

export async function createNestApplication(): Promise<INestApplication> {
  await ensureDatabaseUrl();

  const app = await NestFactory.create(AppModule, {
    logger: process.env.VERCEL ? ["error", "warn"] : undefined,
  });

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
  return app;
}
