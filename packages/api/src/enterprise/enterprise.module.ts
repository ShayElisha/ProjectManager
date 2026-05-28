import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EnterpriseController } from "./enterprise.controller";
import { EnterpriseService } from "./enterprise.service";

@Module({
  imports: [AuditModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
})
export class EnterpriseModule {}
