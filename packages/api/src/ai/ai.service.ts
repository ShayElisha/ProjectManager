import { Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import type { ExecutiveSummary, Task } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { detectOverAllocations } from "@nexus/shared";
import { PortfolioService } from "../portfolio/portfolio.service";

export interface AIInsight {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  taskId?: string;
  suggestedAction?: string;
}

export interface GeneratedPlan {
  tasks: Array<{
    name: string;
    wbs: string;
    durationDays: number;
    parentWbs?: string;
    dependencies?: Array<{ predecessorWbs: string; type: "FS" | "SS" | "FF" | "SF"; lagDays?: number }>;
  }>;
}

@Injectable()
export class AiService {
  constructor(
    private readonly db: DataStoreService,
    private readonly portfolio: PortfolioService,
  ) {}

  executiveSummary(organizationId?: string): ExecutiveSummary {
    const exec = this.portfolio.getExecutive(organizationId);
    const paragraphs: string[] = [];
    const actions: string[] = [];

    for (const p of exec.projects) {
      if (p.health === "critical") {
        paragraphs.push(
          `${p.name}: critical — forecast delay ${p.forecastDelayDays}d, CPI ${p.cpi}, SPI ${p.spi}.`,
        );
        actions.push(`Review scope and resources on "${p.name}" this week.`);
      } else if (p.health === "at_risk") {
        paragraphs.push(
          `${p.name}: at risk — ${p.lateTaskCount} late tasks, budget variance ${p.budgetVariance ?? "n/a"}.`,
        );
      } else {
        paragraphs.push(`${p.name}: on track at ${p.percentComplete}% complete.`);
      }
    }

    if (exec.resourceConflicts.length > 0) {
      actions.push(
        `Resolve ${exec.resourceConflicts.length} cross-project resource conflicts.`,
      );
    }
    if (actions.length < 3) {
      actions.push("Save a new baseline on active projects.");
      actions.push("Run weekly PMO variance review.");
    }

    return {
      generatedAt: exec.generatedAt,
      organizationName: exec.organizationName,
      paragraphs: paragraphs.slice(0, 8),
      actions: actions.slice(0, 3),
    };
  }

  analyzeProject(projectId: string): AIInsight[] {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const tasks = this.db.getTasks(projectId);
    const insights: AIInsight[] = [];
    const today = new Date().toISOString().slice(0, 10);

    const criticalLate = tasks.filter(
      (t) => t.isCritical && t.percentComplete < 100 && t.endDate < today,
    );
    for (const t of criticalLate) {
      insights.push({
        id: uuid(),
        severity: "critical",
        title: "Critical path delay",
        message: `"${t.name}" is on the critical path and past its end date.`,
        taskId: t.id,
        suggestedAction: `Add 3–5 buffer days or reassign resources to task "${t.name}".`,
      });
    }

    const lowProgress = tasks.filter(
      (t) => !t.isSummary && t.percentComplete < 20 && t.status === "in_progress",
    );
    if (lowProgress.length >= 2) {
      insights.push({
        id: uuid(),
        severity: "warning",
        title: "Schedule risk",
        message: `${lowProgress.length} in-progress tasks are below 20% complete.`,
        suggestedAction: "Review resource allocation and update percent complete weekly.",
      });
    }

    const orgId = project.organizationId;
    const resources = this.db.getResources(orgId);
    const slots = detectOverAllocations(
      this.db.getAssignments(projectId),
      tasks,
      resources,
      [today],
    );
    if (slots.some((s) => s.isOverAllocated)) {
      insights.push({
        id: uuid(),
        severity: "warning",
        title: "Resource over-allocation",
        message: "One or more resources exceed capacity today.",
        suggestedAction: "Open the Resources panel and apply leveling suggestions.",
      });
    }

    const budget = tasks.reduce((s, t) => s + (t.plannedCost ?? 0), 0);
    const actual = tasks.reduce((s, t) => s + (t.actualCost ?? 0), 0);
    if (budget > 0 && actual / budget > 0.85 && project.status === "active") {
      const evRatio =
        tasks.reduce((s, t) => s + (t.plannedCost ?? 0) * (t.percentComplete / 100), 0) / budget;
      if (evRatio < 0.7) {
        insights.push({
          id: uuid(),
          severity: "critical",
          title: "Cost overrun forecast",
          message: `Actual cost is ${Math.round((actual / budget) * 100)}% of budget while EV is only ${Math.round(evRatio * 100)}%.`,
          suggestedAction: "Freeze scope changes and run an EVM review with stakeholders.",
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        id: uuid(),
        severity: "info",
        title: "Project health OK",
        message: "No major risks detected. Continue monitoring critical path tasks.",
      });
    }

    return insights;
  }

  async generatePlan(prompt: string): Promise<GeneratedPlan> {
    const llm = await this.generatePlanWithLlm(prompt);
    if (llm) return llm;
    return this.generatePlanHeuristic(prompt);
  }

  private generatePlanHeuristic(prompt: string): GeneratedPlan {
    const lower = prompt.toLowerCase();
    const isEcommerce =
      lower.includes("ecommerce") ||
      lower.includes("e-commerce") ||
      lower.includes("איקומרס") ||
      lower.includes("חנות");
    const isConstruction =
      lower.includes("בניין") || lower.includes("construction") || lower.includes("שיפוץ");

    if (isEcommerce) {
      return {
        tasks: [
          { name: "Discovery & Scope", wbs: "1", durationDays: 10 },
          { name: "UX / Wireframes", wbs: "1.1", durationDays: 12, parentWbs: "1" },
          { name: "Platform Setup", wbs: "2", durationDays: 8, dependencies: [{ predecessorWbs: "1", type: "FS" }] },
          { name: "Catalog & Payments", wbs: "2.1", durationDays: 15, parentWbs: "2" },
          { name: "QA & Launch", wbs: "3", durationDays: 10, dependencies: [{ predecessorWbs: "2.1", type: "FS", lagDays: 2 }] },
        ],
      };
    }

    if (isConstruction) {
      return {
        tasks: [
          { name: "Permits & Design", wbs: "1", durationDays: 20 },
          { name: "Foundation", wbs: "2", durationDays: 14, dependencies: [{ predecessorWbs: "1", type: "FS" }] },
          { name: "Structure", wbs: "3", durationDays: 30, dependencies: [{ predecessorWbs: "2", type: "FS" }] },
          { name: "Finishing", wbs: "4", durationDays: 25, dependencies: [{ predecessorWbs: "3", type: "FS" }] },
        ],
      };
    }

    return {
      tasks: [
        { name: "Initiation", wbs: "1", durationDays: 5 },
        { name: "Planning", wbs: "2", durationDays: 10, dependencies: [{ predecessorWbs: "1", type: "FS" }] },
        { name: "Execution", wbs: "3", durationDays: 20, dependencies: [{ predecessorWbs: "2", type: "FS" }] },
        { name: "Closeout", wbs: "4", durationDays: 5, dependencies: [{ predecessorWbs: "3", type: "FS" }] },
      ],
    };
  }

  private async generatePlanWithLlm(prompt: string): Promise<GeneratedPlan | null> {
    const key = process.env.OPENAI_API_KEY;
    if (!key || !prompt.trim()) return null;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                'Return JSON only: {"tasks":[{"name":"...","wbs":"1","durationDays":5,"parentWbs?":"1","dependencies?":[{"predecessorWbs":"1","type":"FS","lagDays?":0}]}]}',
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      return JSON.parse(match[0]) as GeneratedPlan;
    } catch {
      return null;
    }
  }

  async applyPlan(projectId: string, plan: GeneratedPlan): Promise<Task[]> {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const wbsToId = new Map<string, string>();
    const created: Task[] = [];
    let order = this.db.getTasks(projectId).length;
    let cursor = project.startDate;

    for (const item of plan.tasks) {
      const id = uuid();
      wbsToId.set(item.wbs, id);
      const parentId = item.parentWbs ? wbsToId.get(item.parentWbs) ?? null : null;
      const end = addDays(cursor, item.durationDays - 1);
      const task: Task = {
        id,
        projectId,
        parentId: parentId ?? null,
        wbs: item.wbs,
        name: item.name,
        status: "not_started",
        startDate: cursor,
        endDate: end,
        durationDays: item.durationDays,
        percentComplete: 0,
        isMilestone: false,
        isSummary: Boolean(plan.tasks.some((x) => x.parentWbs === item.wbs)),
        manuallyScheduled: false,
        constraint: "ASAP",
        isCritical: false,
        assigneeIds: [],
        sortOrder: order++,
        isPriority: false,
        plannedCost: item.durationDays * 2000,
        actualCost: 0,
      };
      created.push(task);
      cursor = addDays(end, 1);
    }

    await this.db.bulkCreateTasks(projectId, created);

    for (const item of plan.tasks) {
      if (!item.dependencies) continue;
      const successorId = wbsToId.get(item.wbs);
      if (!successorId) continue;
      for (const dep of item.dependencies) {
        const predId = wbsToId.get(dep.predecessorWbs);
        if (!predId) continue;
        await this.db.addDependency({
          id: uuid(),
          projectId,
          predecessorId: predId,
          successorId,
          type: dep.type,
          lagDays: dep.lagDays ?? 0,
        });
      }
    }

    return this.db.getTasks(projectId);
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
