import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) return;
    try {
      await this.$connect();
      this.connected = true;
    } catch (err) {
      this.logger.warn(
        `Database unavailable (${err instanceof Error ? err.message : err}) — using in-memory store`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.connected) await this.$disconnect();
  }

  get enabled(): boolean {
    return this.connected;
  }
}
