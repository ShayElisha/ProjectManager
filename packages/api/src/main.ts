import "./load-env";
import { createNestApplication } from "./bootstrap";

async function bootstrap() {
  const app = await createNestApplication();
  await app.listen(process.env.PORT ?? 3001);
  console.log(`NexusProject API → http://localhost:${process.env.PORT ?? 3001}/api`);
}
bootstrap();
