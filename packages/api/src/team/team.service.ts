import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import {
  isValidProjectRole,
  normalizeProjectRole,
  type Resource,
  type ProjectMember,
  type ResourceAssignment,
  type Project,
} from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class TeamService {
  constructor(private readonly db: DataStoreService) {}

  getTeam(projectId: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const resources = this.db.getResources(project.organizationId);
    const members = this.db.getProjectMembers(projectId);
    const assignments = this.db.getAssignments(projectId);
    return { project, resources, members, assignments };
  }

  async updateProject(projectId: string, patch: Partial<Project>) {
    const updated = await this.db.updateProject(projectId, patch);
    if (!updated) throw new NotFoundException();
    return updated;
  }

  async addResource(
    orgId: string,
    dto: Omit<Resource, "id" | "organizationId">,
  ): Promise<Resource> {
    return this.db.addResource(orgId, dto);
  }

  async addMember(
    projectId: string,
    dto: {
      name: string;
      email?: string;
      role: ProjectMember["role"];
      costPerHour?: number;
      costPerUnit?: number;
      hoursPerDay?: number;
    },
  ) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException();
    const role = normalizeProjectRole(dto.role);
    if (!isValidProjectRole(role)) {
      throw new BadRequestException("Role must be 1–3 letters");
    }
    const hasGlobal = dto.costPerUnit != null && dto.costPerUnit > 0;
    const resource = await this.db.addResource(project.organizationId, {
      name: dto.name,
      type: "work",
      email: dto.email,
      costPerHour: hasGlobal ? undefined : (dto.costPerHour ?? 250),
      costPerUnit: hasGlobal ? dto.costPerUnit : undefined,
      maxUnits: 1,
    });
    const member: ProjectMember = {
      id: uuid(),
      projectId,
      resourceId: resource.id,
      role,
      hoursPerDay: dto.hoursPerDay,
    };
    await this.db.addProjectMember(member);
    return { resource, member };
  }

  async updateMember(
    projectId: string,
    memberId: string,
    dto: {
      role?: ProjectMember["role"];
      hoursPerDay?: number;
      costPerHour?: number | null;
      costPerUnit?: number | null;
      name?: string;
      email?: string;
    },
  ) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException();
    const members = this.db.getProjectMembers(projectId);
    const member = members.find((m) => m.id === memberId);
    if (!member) throw new NotFoundException();

    if (dto.role !== undefined) {
      const role = normalizeProjectRole(dto.role);
      if (!isValidProjectRole(role)) {
        throw new BadRequestException("Role must be 1–3 letters");
      }
      await this.db.updateProjectMember(projectId, memberId, {
        role,
        hoursPerDay: dto.hoursPerDay,
      });
    } else if (dto.hoursPerDay !== undefined) {
      await this.db.updateProjectMember(projectId, memberId, { hoursPerDay: dto.hoursPerDay });
    }

    const resourcePatch: Parameters<DataStoreService["updateResource"]>[2] = {};
    if (dto.name !== undefined) resourcePatch.name = dto.name;
    if (dto.email !== undefined) resourcePatch.email = dto.email;
    if (dto.costPerHour !== undefined) resourcePatch.costPerHour = dto.costPerHour;
    if (dto.costPerUnit !== undefined) resourcePatch.costPerUnit = dto.costPerUnit;

    const resource = await this.db.updateResource(
      project.organizationId,
      member.resourceId,
      resourcePatch,
    );
    const updatedMember =
      this.db.getProjectMembers(projectId).find((m) => m.id === memberId) ?? member;
    if (!resource) throw new NotFoundException();
    return { resource, member: updatedMember };
  }

  async assignToTask(
    projectId: string,
    taskId: string,
    resourceId: string,
    workHours: number,
    units = 1,
  ): Promise<ResourceAssignment> {
    return this.db.addAssignment({
      id: uuid(),
      taskId,
      resourceId,
      units,
      workHours,
    });
  }
}
