import type {
  Project,
  Task,
  TaskDependency,
  Resource,
  ResourceAssignment,
  Baseline,
  TimesheetEntry,
  Notification,
  ProjectMember,
  BudgetLineItem,
  ProjectRisk,
  ChangeRequest,
  ManualRejectionEntry,
} from "@nexus/shared";
import { buildSeedData } from "./seed-data";

export class InMemoryBackend {
  organizationName = "Nexus Corp";
  organizationId = "";
  projects = new Map<string, Project>();
  tasks = new Map<string, Task[]>();
  dependencies = new Map<string, TaskDependency[]>();
  resources = new Map<string, Resource[]>();
  assignments = new Map<string, ResourceAssignment[]>();
  baselines = new Map<string, Baseline[]>();
  timesheets: TimesheetEntry[] = [];
  notifications: Notification[] = [];
  projectMembers = new Map<string, ProjectMember[]>();
  budgetLines = new Map<string, BudgetLineItem[]>();
  risks = new Map<string, ProjectRisk[]>();
  changeRequests = new Map<string, ChangeRequest[]>();
  rejectionLogs = new Map<string, ManualRejectionEntry[]>();

  seed() {
    if (this.projects.size > 0) return;
    const data = buildSeedData();
    this.organizationId = data.organizationId;
    this.organizationName = data.organizationName;
    for (const p of data.projects) this.projects.set(p.id, p);
    for (const [k, v] of data.tasks) this.tasks.set(k, v);
    for (const [k, v] of data.dependencies) this.dependencies.set(k, v);
    this.resources.set(data.organizationId, data.resources);
    for (const [k, v] of data.assignments) this.assignments.set(k, v);
    for (const p of data.projects) {
      this.baselines.set(p.id, []);
      this.budgetLines.set(p.id, []);
      this.risks.set(p.id, []);
      this.changeRequests.set(p.id, []);
      this.rejectionLogs.set(p.id, []);
    }
    const lead = data.resources[0];
    if (lead) {
      for (const p of data.projects) {
        this.projectMembers.set(p.id, [
          {
            id: `${p.id}-pm`,
            projectId: p.id,
            resourceId: lead.id,
            role: "PMO",
            hoursPerDay: p.hoursPerDay ?? 8,
          },
        ]);
      }
    }
  }

  loadFromSeedData(data: ReturnType<typeof buildSeedData>) {
    this.projects.clear();
    this.tasks.clear();
    this.dependencies.clear();
    this.assignments.clear();
    this.baselines.clear();
    this.organizationId = data.organizationId;
    this.organizationName = data.organizationName;
    for (const p of data.projects) {
      this.projects.set(p.id, p);
      this.baselines.set(p.id, []);
      if (!this.budgetLines.has(p.id)) this.budgetLines.set(p.id, []);
      if (!this.risks.has(p.id)) this.risks.set(p.id, []);
      if (!this.changeRequests.has(p.id)) this.changeRequests.set(p.id, []);
      if (!this.rejectionLogs.has(p.id)) this.rejectionLogs.set(p.id, []);
    }
    for (const [k, v] of data.tasks) this.tasks.set(k, [...v]);
    for (const [k, v] of data.dependencies) this.dependencies.set(k, [...v]);
    this.resources.set(data.organizationId, [...data.resources]);
    for (const [k, v] of data.assignments) this.assignments.set(k, [...v]);
  }
}
