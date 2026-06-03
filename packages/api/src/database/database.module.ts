import { Global, Module } from "@nestjs/common";
import { PrismaServiceStub } from "./prisma.service.stub";
import { PRISMA } from "./prisma.token";
import { DataStoreService } from "./data-store.service";

function createPrisma() {
  if (process.env.VERCEL) return new PrismaServiceStub();
  const { PrismaService } = require("./prisma.service") as typeof import("./prisma.service");
  return new PrismaService();
}

@Global()
@Module({
  providers: [{ provide: PRISMA, useFactory: createPrisma }, DataStoreService],
  exports: [PRISMA, DataStoreService],
})
export class DatabaseModule {}
