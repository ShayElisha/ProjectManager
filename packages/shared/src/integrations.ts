export type ReportWidgetType = "status" | "resources" | "cashflow" | "task_list";

export interface CustomReport {
  id: string;
  projectId: string;
  name: string;
  widgets: ReportWidgetType[];
  createdAt: string;
}

export type WebhookEvent =
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "project.updated";

export interface WebhookSubscription {
  id: string;
  projectId: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled: boolean;
}

export interface ProjectIntegrations {
  projectId: string;
  slackWebhookUrl?: string;
  emailInboundSecret?: string;
  zapierHookToken?: string;
}

export interface Goal {
  id: string;
  projectId: string;
  title: string;
  period: string;
  progress: number;
}

export interface KeyResult {
  id: string;
  goalId: string;
  projectId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit?: string;
}

export interface WhiteboardItem {
  id: string;
  projectId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
}
