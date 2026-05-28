import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { UserAccount } from "@nexus/shared";
import { roleAtLeast } from "@nexus/shared";
import type { DataStoreService } from "../database/data-store.service";

export function assertOrgAccess(user: UserAccount, organizationId: string): void {
  if (roleAtLeast(user.role, "admin") && !user.organizationId) return;
  if (user.organizationId !== organizationId) {
    throw new ForbiddenException("ORG_ACCESS_DENIED");
  }
}

export function assertProjectAccess(
  db: DataStoreService,
  user: UserAccount,
  projectId: string,
): void {
  const project = db.getProject(projectId);
  if (!project) throw new NotFoundException("Project not found");
  assertOrgAccess(user, project.organizationId);
}

export function resolveOrgFilter(
  user: UserAccount,
  requestedOrgId?: string,
): string | undefined {
  if (roleAtLeast(user.role, "admin") && requestedOrgId) return requestedOrgId;
  return user.organizationId;
}
