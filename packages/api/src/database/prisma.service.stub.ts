import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { PrismaConnectFacade } from "./prisma.token";

/** Vercel cold start: skip Prisma engine (in-memory + lite auth handler). */
@Injectable()
export class PrismaServiceStub implements OnModuleInit, OnModuleDestroy, PrismaConnectFacade {
  private readonly logger = new Logger(PrismaServiceStub.name);
  readonly enabled = false;

  async onModuleInit() {
    this.logger.warn("Prisma stub active on Vercel (in-memory API)");
  }

  async onModuleDestroy() {}

  async connectHostedDb(): Promise<boolean> {
    return false;
  }
}
