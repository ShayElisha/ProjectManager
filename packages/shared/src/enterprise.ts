import type { UserRole } from "./types";

export type TaskPermissionLevel = "read" | "write" | "admin";

export interface TaskPermission {
  id: string;
  projectId: string;
  taskId: string;
  userId: string;
  level: TaskPermissionLevel;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Program {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  projectIds: string[];
  startDate?: string;
  endDate?: string;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  projectId?: string;
  clientName: string;
  clientEmail?: string;
  status: "draft" | "sent" | "paid";
  currency: string;
  lines: InvoiceLine[];
  total: number;
  dueDate?: string;
  createdAt: string;
}

export interface ProofAsset {
  id: string;
  projectId: string;
  taskId?: string;
  title: string;
  fileUrl?: string;
  status: "pending" | "approved" | "rejected";
  reviewerNote?: string;
  createdAt: string;
}

export interface CrmContact {
  id: string;
  organizationId: string;
  name: string;
  email?: string;
  company?: string;
  phone?: string;
}

export interface CrmDeal {
  id: string;
  organizationId: string;
  contactId?: string;
  title: string;
  value: number;
  stage: "lead" | "qualified" | "proposal" | "won" | "lost";
  projectId?: string;
}

export interface OrgAutomationRule {
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  event: string;
  actionType: "notify" | "webhook";
  actionPayload?: Record<string, unknown>;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  currency: string;
  maxProjects: number;
  maxUsers: number;
}

export const ROLE_RANK: Record<UserRole, number> = {
  admin: 100,
  pmo: 80,
  project_manager: 60,
  team_member: 30,
  viewer: 10,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
