import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Project, UserAccount } from "@nexus/shared";
import { roleAtLeast } from "@nexus/shared";
import type { DataStoreService } from "../database/data-store.service";

export function filterProjectsForUser(
  db: DataStoreService,
  projects: Project[],
  user?: UserAccount,
): Project[] {
  if (!user?.email) return [];
  const email = user.email.trim().toLowerCase();
  const resources = db
    .getResources(user.organizationId ?? "")
    .filter((r) => r.email?.trim().toLowerCase() === email);
  const resourceIds = new Set(resources.map((r) => r.id));
  if (resourceIds.size === 0) return [];

  const allowed = new Set<string>();
  for (const project of projects) {
    const members = db.getProjectMembers(project.id);
    if (members.some((m) => resourceIds.has(m.resourceId))) {
      allowed.add(project.id);
      continue;
    }
    const tasks = db.getTasks(project.id);
    if (tasks.some((t) => t.assigneeIds?.some((id) => resourceIds.has(id)))) {
      allowed.add(project.id);
    }
  }
  return projects.filter((p) => allowed.has(p.id));
}

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
  if (filterProjectsForUser(db, [project], user).length === 0) {
    throw new ForbiddenException("PROJECT_ACCESS_DENIED");
  }
}

export function resolveOrgFilter(
  user: UserAccount | undefined,
  requestedOrgId?: string,
): string | undefined {
  if (!user) return requestedOrgId;
  if (roleAtLeast(user.role, "admin") && requestedOrgId) return requestedOrgId;
  return user.organizationId;
}
