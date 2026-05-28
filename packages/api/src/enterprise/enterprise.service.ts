import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CrmContact,
  CrmDeal,
  Invoice,
  OrgAutomationRule,
  Program,
  ProofAsset,
  SubscriptionPlan,
  TaskPermission,
  TaskPermissionLevel,
  UserAccount,
} from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { AuditService } from "../audit/audit.service";
import { assertOrgAccess } from "../common/org-access";

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly db: DataStoreService,
    private readonly audit: AuditService,
  ) {}

  auditLogs(user: UserAccount, organizationId: string) {
    assertOrgAccess(user, organizationId);
    return this.db.getAuditLogs(organizationId);
  }

  taskPermissions(user: UserAccount, projectId: string, taskId?: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException();
    assertOrgAccess(user, project.organizationId);
    return this.db.getTaskPermissions(projectId, taskId);
  }

  setTaskPermission(
    user: UserAccount,
    projectId: string,
    body: { taskId: string; userId: string; level: TaskPermissionLevel },
  ): TaskPermission {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException();
    assertOrgAccess(user, project.organizationId);
    const perm = this.db.setTaskPermission({ ...body, projectId });
    this.audit.log(user, project.organizationId, "grant", "task_permission", `Granted ${body.level} on task`, body.taskId);
    return perm;
  }

  programs(user: UserAccount, organizationId: string) {
    assertOrgAccess(user, organizationId);
    return this.db.getPrograms(organizationId);
  }

  createProgram(
    user: UserAccount,
    organizationId: string,
    body: { name: string; description?: string; projectIds?: string[]; startDate?: string; endDate?: string },
  ): Program {
    assertOrgAccess(user, organizationId);
    const program = this.db.createProgram({
      organizationId,
      name: body.name,
      description: body.description,
      projectIds: body.projectIds ?? [],
      startDate: body.startDate,
      endDate: body.endDate,
    });
    this.audit.log(user, organizationId, "create", "program", `Created program «${program.name}»`, program.id);
    return program;
  }

  invoices(user: UserAccount, organizationId: string) {
    assertOrgAccess(user, organizationId);
    return this.db.getInvoices(organizationId);
  }

  createInvoice(
    user: UserAccount,
    organizationId: string,
    body: {
      clientName: string;
      clientEmail?: string;
      projectId?: string;
      currency?: string;
      lines: Invoice["lines"];
      dueDate?: string;
    },
  ): Invoice {
    assertOrgAccess(user, organizationId);
    const inv = this.db.createInvoice({
      organizationId,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      projectId: body.projectId,
      currency: body.currency ?? "ILS",
      status: "draft",
      lines: body.lines,
      dueDate: body.dueDate,
    });
    this.audit.log(user, organizationId, "create", "invoice", `Invoice for ${body.clientName}`, inv.id);
    return inv;
  }

  proofAssets(user: UserAccount, projectId: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException();
    assertOrgAccess(user, project.organizationId);
    return this.db.getProofAssets(projectId);
  }

  createProof(
    user: UserAccount,
    projectId: string,
    body: { title: string; taskId?: string; fileUrl?: string },
  ): ProofAsset {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException();
    assertOrgAccess(user, project.organizationId);
    return this.db.createProofAsset({ projectId, ...body });
  }

  reviewProof(
    user: UserAccount,
    projectId: string,
    proofId: string,
    body: { status: "approved" | "rejected"; reviewerNote?: string },
  ) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException();
    assertOrgAccess(user, project.organizationId);
    const updated = this.db.updateProofAsset(proofId, body);
    if (!updated) throw new NotFoundException();
    this.audit.log(user, project.organizationId, "review", "proof", `Proof ${body.status}`, proofId);
    return updated;
  }

  crmContacts(user: UserAccount, organizationId: string) {
    assertOrgAccess(user, organizationId);
    return this.db.getCrmContacts(organizationId);
  }

  createCrmContact(
    user: UserAccount,
    organizationId: string,
    body: Omit<CrmContact, "id" | "organizationId">,
  ): CrmContact {
    assertOrgAccess(user, organizationId);
    return this.db.createCrmContact({ ...body, organizationId });
  }

  crmDeals(user: UserAccount, organizationId: string) {
    assertOrgAccess(user, organizationId);
    return this.db.getCrmDeals(organizationId);
  }

  createCrmDeal(
    user: UserAccount,
    organizationId: string,
    body: Omit<CrmDeal, "id" | "organizationId">,
  ): CrmDeal {
    assertOrgAccess(user, organizationId);
    return this.db.createCrmDeal({ ...body, organizationId });
  }

  orgAutomation(user: UserAccount, organizationId: string) {
    assertOrgAccess(user, organizationId);
    return this.db.getOrgAutomationRules(organizationId);
  }

  createOrgAutomation(
    user: UserAccount,
    organizationId: string,
    body: Omit<OrgAutomationRule, "id" | "organizationId">,
  ): OrgAutomationRule {
    assertOrgAccess(user, organizationId);
    return this.db.createOrgAutomationRule({ ...body, organizationId });
  }

  subscriptionPlans(): SubscriptionPlan[] {
    return this.db.getSubscriptionPlans();
  }

  async createCheckoutSession(
    user: UserAccount,
    organizationId: string,
    planId: string,
  ): Promise<{ url?: string; mock?: boolean; planId: string }> {
    assertOrgAccess(user, organizationId);
    const plan = this.db.getSubscriptionPlans().find((p) => p.id === planId);
    if (!plan) throw new NotFoundException("Plan not found");
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return { mock: true, planId, url: undefined };
    }
    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price_data][currency]": plan.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": plan.name,
      "line_items[0][price_data][unit_amount]": String(plan.priceMonthly * 100),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][quantity]": "1",
      success_url: process.env.STRIPE_SUCCESS_URL ?? "http://localhost:5173/app",
      cancel_url: process.env.STRIPE_CANCEL_URL ?? "http://localhost:5173/app",
      "metadata[organizationId]": organizationId,
      "metadata[planId]": planId,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) return { mock: true, planId };
    const data = (await res.json()) as { url?: string };
    return { url: data.url, planId };
  }
}
