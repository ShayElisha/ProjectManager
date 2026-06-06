import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { getProjectFinancials } from "@nexus/shared";
import type { Project, EVMMetrics, Task, TaskDependency, UserAccount } from "@nexus/shared";
import { v4 as uuid } from "uuid";
import { filterProjectsForUser } from "../common/org-access";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class ProjectsService {
  constructor(private readonly db: DataStoreService) {}

  findAll(
    filters?: {
      organizationId?: string;
      parentId?: string | null;
      isTemplate?: boolean;
    },
    user?: UserAccount,
  ): Project[] {
    let list = this.db.getProjects();
    if (filters?.organizationId) {
      list = list.filter((p) => p.organizationId === filters.organizationId);
    }
    if (filters?.isTemplate !== undefined) {
      list = list.filter((p) => !!p.isTemplate === filters.isTemplate);
    }
    if (filters && "parentId" in filters) {
      const pid = filters.parentId ?? null;
      list = list.filter((p) => (p.parentId ?? null) === pid);
    }
    return filterProjectsForUser(this.db, list, user);
  }

  findOne(id: string): Project {
    const p = this.db.getProject(id);
    if (!p) throw new NotFoundException(`Project ${id} not found`);
    return p;
  }

  async create(dto: Partial<Project>, user?: UserAccount) {
    if (dto.organizationId) {
      const count = this.db.getProjects().filter((p) => p.organizationId === dto.organizationId).length;
      const plans = this.db.getSubscriptionPlans();
      const plan = plans.find((p) => p.id === "pro") ?? plans[plans.length - 1];
      if (plan && count >= plan.maxProjects) {
        throw new BadRequestException(`PLAN_LIMIT: max ${plan.maxProjects} projects on ${plan.name}`);
      }
    }
    const project = await this.db.createProject(dto);
    if (user?.email && project.organizationId) {
      const email = user.email.trim().toLowerCase();
      let resource = this.db
        .getResources(project.organizationId)
        .find((r) => r.email?.trim().toLowerCase() === email);
      if (!resource) {
        resource = await this.db.addResource(project.organizationId, {
          name: user.name || email.split("@")[0] || "User",
          type: "work",
          email: user.email,
          maxUnits: 1,
        });
      }
      await this.db.addProjectMember({
        id: uuid(),
        projectId: project.id,
        resourceId: resource.id,
        role: "pm",
        hoursPerDay: project.hoursPerDay,
      });
    }
    return project;
  }

  async update(id: string, patch: Partial<Project>) {
    const updated = await this.db.updateProject(id, patch);
    if (!updated) throw new NotFoundException(`Project ${id} not found`);
    return updated;
  }

  getEVM(projectId: string): EVMMetrics {
    const project = this.findOne(projectId);
    const tasks = this.db.getTasks(projectId);
    const lines = this.db.getBudgetLines(projectId);
    const assignments = this.db.getAssignments(projectId);
    const resources = this.db.getResources(project.organizationId);
    const timesheets = this.db.getTimesheets(projectId);
    const members = this.db.getProjectMembers(projectId);
    return getProjectFinancials({
      projectId,
      currency: project.currency,
      budgetCap: project.budgetCap,
      tasks,
      lines,
      assignments,
      resources,
      timesheets,
      members,
      hoursPerDay: project.hoursPerDay ?? 8,
    }).evm;
  }

  async importProject(
    projectId: string,
    data: {
      tasks?: Task[];
      dependencies?: TaskDependency[];
    },
  ) {
    this.findOne(projectId);
    if (data.tasks?.length) {
      const remapped = data.tasks.map((t) => ({
        ...t,
        id: uuid(),
        projectId,
      }));
      const idMap = new Map(data.tasks.map((old, i) => [old.id, remapped[i].id]));
      const tasks = remapped.map((t) => ({
        ...t,
        parentId: t.parentId ? (idMap.get(t.parentId) ?? null) : null,
      }));
      await this.db.bulkCreateTasks(projectId, tasks);
      if (data.dependencies?.length) {
        for (const d of data.dependencies) {
          const pred = idMap.get(d.predecessorId);
          const succ = idMap.get(d.successorId);
          if (pred && succ) {
            await this.db.addDependency({
              ...d,
              id: uuid(),
              projectId,
              predecessorId: pred,
              successorId: succ,
            });
          }
        }
      }
      return { importedTasks: tasks.length };
    }
    return { importedTasks: 0 };
  }

  async remove(id: string) {
    const ok = await this.db.deleteProject(id);
    if (!ok) throw new NotFoundException(`Project ${id} not found`);
    return { deleted: true };
  }

  async createFromTemplate(
    templateId: string,
    body: { name: string; organizationId?: string; parentId?: string | null },
  ) {
    const created = await this.db.cloneProjectFromTemplate(templateId, body);
    if (!created) throw new NotFoundException(`Template ${templateId} not found`);
    return created;
  }

  async duplicate(projectId: string, body: { name: string; organizationId?: string; parentId?: string | null }) {
    const created = await this.db.duplicateProject(projectId, body);
    if (!created) throw new NotFoundException(`Project ${projectId} not found`);
    return created;
  }

  async saveAsTemplate(projectId: string, name?: string) {
    const p = this.findOne(projectId);
    const updated = await this.db.updateProject(projectId, {
      isTemplate: true,
      name: name ?? `${p.name} (template)`,
    });
    return updated;
  }

  exportProject(projectId: string) {
    const project = this.findOne(projectId);
    return {
      project,
      tasks: this.db.getTasks(projectId),
      dependencies: this.db.getDependencies(projectId),
      baselines: this.db.getBaselines(projectId),
      assignments: this.db.getAssignments(projectId),
      exportedAt: new Date().toISOString(),
    };
  }
}
