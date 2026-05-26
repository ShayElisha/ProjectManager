import "./load-env";
import { ensureDatabaseUrl } from "./ensure-database";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  await ensureDatabaseUrl();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: ["http://localhost:5173"], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT ?? 3001);
  console.log(`NexusProject API → http://localhost:${process.env.PORT ?? 3001}/api`);
}
bootstrap();
