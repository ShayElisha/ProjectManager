import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const DB_CONNECT_TIMEOUT_MS = process.env.VERCEL ? 2500 : 7000;

function isHostedMongoUrl(url: string): boolean {
  return url.includes("mongodb+srv://") || url.includes("mongodb.net");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit() {
    const url = process.env.DATABASE_URL?.trim() ?? "";
    if (!url) return;
    const isBuildStub =
      url.includes("127.0.0.1") || url.includes("localhost") || url.includes("nexus_build");
    if (process.env.VERCEL) {
      if (isBuildStub || !isHostedMongoUrl(url)) {
        this.logger.warn("Skipping DATABASE_URL on Vercel — in-memory API mode (set Atlas mongodb+srv URL to persist).");
        return;
      }
    }
    try {
      await withTimeout(this.$connect(), DB_CONNECT_TIMEOUT_MS, "Prisma connect");
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
