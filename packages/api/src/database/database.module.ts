import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { DataStoreService } from "./data-store.service";

@Global()
@Module({
  providers: [PrismaService, DataStoreService],
  exports: [PrismaService, DataStoreService],
})
export class DatabaseModule {}
