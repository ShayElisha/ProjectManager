import { Injectable } from "@nestjs/common";
import type { UserAccount } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class AuditService {
  constructor(private readonly db: DataStoreService) {}

  log(
    user: UserAccount | undefined,
    organizationId: string,
    action: string,
    entityType: string,
    summary: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.db.writeAudit({
      organizationId,
      userId: user?.id,
      userName: user?.name,
      action,
      entityType,
      entityId,
      summary,
      metadata,
    });
  }
}
