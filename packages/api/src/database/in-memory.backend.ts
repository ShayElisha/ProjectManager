import type {
  Organization,
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
  TaskComment,
  TaskAttachment,
  ActiveTimer,
  UserAccount,
  CustomColumn,
  Sprint,
  Cycle,
  ProjectForm,
  SavedView,
  AutomationRule,
  ActivityLogEntry,
  ProjectMessage,
  ProjectWikiPage,
  ProjectGuest,
  CustomReport,
  WebhookSubscription,
  ProjectIntegrations,
  Goal,
  KeyResult,
  WhiteboardItem,
  ResourcePto,
  AuditLogEntry,
  TaskPermission,
  Program,
  Invoice,
  ProofAsset,
  CrmContact,
  CrmDeal,
  OrgAutomationRule,
  SubscriptionPlan,
} from "@nexus/shared";
import { buildSeedData } from "./seed-data";

export interface StoredUserRecord extends UserAccount {
  passwordHash: string;
  totpSecret?: string;
  totpEnabled?: boolean;
}

export class InMemoryBackend {
  organizations = new Map<string, Organization>();
  organizationName = "Nexus Corp";
  organizationId = "";
  users = new Map<string, StoredUserRecord>();
  usersByEmail = new Map<string, string>();
  taskComments: TaskComment[] = [];
  taskAttachments: TaskAttachment[] = [];
  activeTimers: ActiveTimer[] = [];
  customColumns = new Map<string, CustomColumn[]>();
  sprints = new Map<string, Sprint[]>();
  cycles = new Map<string, Cycle[]>();
  projectForms = new Map<string, ProjectForm[]>();
  savedViews = new Map<string, SavedView[]>();
  automationRules = new Map<string, AutomationRule[]>();
  activityLogs = new Map<string, ActivityLogEntry[]>();
  projectMessages = new Map<string, ProjectMessage[]>();
  wikiPages = new Map<string, ProjectWikiPage[]>();
  projectGuests = new Map<string, ProjectGuest[]>();
  customReports = new Map<string, CustomReport[]>();
  webhookSubscriptions = new Map<string, WebhookSubscription[]>();
  projectIntegrations = new Map<string, ProjectIntegrations>();
  goals = new Map<string, Goal[]>();
  keyResults = new Map<string, KeyResult[]>();
  whiteboardItems = new Map<string, WhiteboardItem[]>();
  resourcePtos: ResourcePto[] = [];
  auditLogs: AuditLogEntry[] = [];
  taskPermissions: TaskPermission[] = [];
  programs: Program[] = [];
  invoices: Invoice[] = [];
  proofAssets: ProofAsset[] = [];
  crmContacts: CrmContact[] = [];
  crmDeals: CrmDeal[] = [];
  orgAutomationRules: OrgAutomationRule[] = [];
  subscriptionPlans: SubscriptionPlan[] = [
    { id: "starter", name: "Starter", priceMonthly: 49, currency: "USD", maxProjects: 5, maxUsers: 10 },
    { id: "pro", name: "Pro", priceMonthly: 149, currency: "USD", maxProjects: 25, maxUsers: 50 },
    { id: "enterprise", name: "Enterprise", priceMonthly: 499, currency: "USD", maxProjects: 999, maxUsers: 999 },
  ];
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
    this.organizations.set(data.organizationId, {
      id: data.organizationId,
      name: data.organizationName,
      defaultLocale: "he",
      defaultCurrency: "ILS",
    });
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
      if (!this.customColumns.has(p.id)) this.customColumns.set(p.id, []);
      if (!this.sprints.has(p.id)) this.sprints.set(p.id, []);
      if (!this.cycles.has(p.id)) this.cycles.set(p.id, []);
      if (!this.projectForms.has(p.id)) this.projectForms.set(p.id, []);
      if (!this.savedViews.has(p.id)) this.savedViews.set(p.id, []);
      if (!this.automationRules.has(p.id)) this.automationRules.set(p.id, []);
      if (!this.activityLogs.has(p.id)) this.activityLogs.set(p.id, []);
      if (!this.projectMessages.has(p.id)) this.projectMessages.set(p.id, []);
      if (!this.wikiPages.has(p.id)) this.wikiPages.set(p.id, []);
      if (!this.projectGuests.has(p.id)) this.projectGuests.set(p.id, []);
      if (!this.customReports.has(p.id)) this.customReports.set(p.id, []);
      if (!this.webhookSubscriptions.has(p.id)) this.webhookSubscriptions.set(p.id, []);
      if (!this.goals.has(p.id)) this.goals.set(p.id, []);
      if (!this.keyResults.has(p.id)) this.keyResults.set(p.id, []);
      if (!this.whiteboardItems.has(p.id)) this.whiteboardItems.set(p.id, []);
      if (!this.projectIntegrations.has(p.id)) {
        this.projectIntegrations.set(p.id, { projectId: p.id });
      }
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
    this.organizations.set(data.organizationId, {
      id: data.organizationId,
      name: data.organizationName,
      defaultLocale: "he",
      defaultCurrency: "ILS",
    });
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
