import { Injectable, NotFoundException } from "@nestjs/common";
import type { ChangeRequest, ChangeRequestStatus } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class ChangesService {
  constructor(private readonly db: DataStoreService) {}

  list(projectId: string) {
    return this.db.getChangeRequests(projectId);
  }

  create(
    projectId: string,
    body: {
      title: string;
      description?: string;
      impactScheduleDays?: number;
      impactCost?: number;
      requestedBy?: string;
    },
  ) {
    this.assertProject(projectId);
    return this.db.createChangeRequest(projectId, {
      title: body.title,
      description: body.description,
      impactScheduleDays: body.impactScheduleDays ?? 0,
      impactCost: body.impactCost ?? 0,
      requestedBy: body.requestedBy,
    });
  }

  update(projectId: string, crId: string, patch: Partial<ChangeRequest>) {
    return this.db.updateChangeRequest(projectId, crId, patch);
  }

  async transition(
    projectId: string,
    crId: string,
    status: ChangeRequestStatus,
    decisionNote?: string,
  ) {
    const list = this.db.getChangeRequests(projectId);
    const cr = list.find((c) => c.id === crId);
    if (!cr) throw new NotFoundException(`Change request ${crId} not found`);
    const allowed: Record<ChangeRequestStatus, ChangeRequestStatus[]> = {
      draft: ["submitted"],
      submitted: ["approved", "rejected"],
      approved: [],
      rejected: [],
    };
    if (!allowed[cr.status]?.includes(status)) {
      throw new NotFoundException(`Cannot move from ${cr.status} to ${status}`);
    }
    return this.db.updateChangeRequest(projectId, crId, {
      status,
      decidedAt: new Date().toISOString(),
      decisionNote,
    });
  }

  async remove(projectId: string, crId: string) {
    const ok = await this.db.deleteChangeRequest(projectId, crId);
    if (!ok) throw new NotFoundException(`Change request ${crId} not found`);
    return { ok: true };
  }

  private assertProject(projectId: string) {
    if (!this.db.getProject(projectId)) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
  }
}
