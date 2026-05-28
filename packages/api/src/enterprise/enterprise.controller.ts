import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { UserAccount, TaskPermissionLevel } from "@nexus/shared";
import { Roles } from "../auth/roles.decorator";
import { EnterpriseService } from "./enterprise.service";

@Controller()
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  @Get("organizations/:orgId/audit")
  audit(@Req() req: { user: UserAccount }, @Param("orgId") orgId: string) {
    return this.enterprise.auditLogs(req.user, orgId);
  }

  @Get("organizations/:orgId/programs")
  programs(@Req() req: { user: UserAccount }, @Param("orgId") orgId: string) {
    return this.enterprise.programs(req.user, orgId);
  }

  @Post("organizations/:orgId/programs")
  @Roles("project_manager")
  createProgram(
    @Req() req: { user: UserAccount },
    @Param("orgId") orgId: string,
    @Body() body: { name: string; description?: string; projectIds?: string[] },
  ) {
    return this.enterprise.createProgram(req.user, orgId, body);
  }

  @Get("organizations/:orgId/invoices")
  invoices(@Req() req: { user: UserAccount }, @Param("orgId") orgId: string) {
    return this.enterprise.invoices(req.user, orgId);
  }

  @Post("organizations/:orgId/invoices")
  @Roles("project_manager")
  createInvoice(
    @Req() req: { user: UserAccount },
    @Param("orgId") orgId: string,
    @Body()
    body: {
      clientName: string;
      clientEmail?: string;
      projectId?: string;
      currency?: string;
      lines: { description: string; quantity: number; unitPrice: number }[];
      dueDate?: string;
    },
  ) {
    return this.enterprise.createInvoice(req.user, orgId, body);
  }

  @Get("organizations/:orgId/crm/contacts")
  crmContacts(@Req() req: { user: UserAccount }, @Param("orgId") orgId: string) {
    return this.enterprise.crmContacts(req.user, orgId);
  }

  @Post("organizations/:orgId/crm/contacts")
  createCrmContact(
    @Req() req: { user: UserAccount },
    @Param("orgId") orgId: string,
    @Body() body: { name: string; email?: string; company?: string; phone?: string },
  ) {
    return this.enterprise.createCrmContact(req.user, orgId, body);
  }

  @Get("organizations/:orgId/crm/deals")
  crmDeals(@Req() req: { user: UserAccount }, @Param("orgId") orgId: string) {
    return this.enterprise.crmDeals(req.user, orgId);
  }

  @Post("organizations/:orgId/crm/deals")
  createCrmDeal(
    @Req() req: { user: UserAccount },
    @Param("orgId") orgId: string,
    @Body()
    body: {
      title: string;
      value: number;
      stage?: "lead" | "qualified" | "proposal" | "won" | "lost";
      contactId?: string;
      projectId?: string;
    },
  ) {
    return this.enterprise.createCrmDeal(req.user, orgId, {
      title: body.title,
      value: body.value,
      stage: body.stage ?? "lead",
      contactId: body.contactId,
      projectId: body.projectId,
    });
  }

  @Get("organizations/:orgId/automation-rules")
  orgAutomation(@Req() req: { user: UserAccount }, @Param("orgId") orgId: string) {
    return this.enterprise.orgAutomation(req.user, orgId);
  }

  @Post("organizations/:orgId/automation-rules")
  @Roles("admin")
  createOrgAutomation(
    @Req() req: { user: UserAccount },
    @Param("orgId") orgId: string,
    @Body()
    body: {
      name: string;
      enabled?: boolean;
      event: string;
      actionType: "notify" | "webhook";
      actionPayload?: Record<string, unknown>;
    },
  ) {
    return this.enterprise.createOrgAutomation(req.user, orgId, {
      name: body.name,
      enabled: body.enabled ?? true,
      event: body.event,
      actionType: body.actionType,
      actionPayload: body.actionPayload,
    });
  }

  @Get("billing/plans")
  plans() {
    return this.enterprise.subscriptionPlans();
  }

  @Post("organizations/:orgId/billing/checkout")
  @Roles("admin")
  checkout(
    @Req() req: { user: UserAccount },
    @Param("orgId") orgId: string,
    @Body() body: { planId: string },
  ) {
    return this.enterprise.createCheckoutSession(req.user, orgId, body.planId);
  }

  @Get("projects/:projectId/task-permissions")
  taskPermissions(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Query("taskId") taskId?: string,
  ) {
    return this.enterprise.taskPermissions(req.user, projectId, taskId);
  }

  @Post("projects/:projectId/task-permissions")
  @Roles("project_manager")
  setTaskPermission(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Body() body: { taskId: string; userId: string; level: TaskPermissionLevel },
  ) {
    return this.enterprise.setTaskPermission(req.user, projectId, body);
  }

  @Get("projects/:projectId/proofs")
  proofs(@Req() req: { user: UserAccount }, @Param("projectId") projectId: string) {
    return this.enterprise.proofAssets(req.user, projectId);
  }

  @Post("projects/:projectId/proofs")
  createProof(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Body() body: { title: string; taskId?: string; fileUrl?: string },
  ) {
    return this.enterprise.createProof(req.user, projectId, body);
  }

  @Patch("projects/:projectId/proofs/:proofId")
  reviewProof(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Param("proofId") proofId: string,
    @Body() body: { status: "approved" | "rejected"; reviewerNote?: string },
  ) {
    return this.enterprise.reviewProof(req.user, projectId, proofId, body);
  }
}
