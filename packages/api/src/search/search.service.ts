import { Injectable } from "@nestjs/common";
import type { SearchHit } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class SearchService {
  constructor(private readonly db: DataStoreService) {}

  search(q: string, organizationId?: string): SearchHit[] {
    const needle = q.trim().toLowerCase();
    if (!needle || needle.length < 2) return [];

    const hits: SearchHit[] = [];
    const projects = this.db
      .getProjects()
      .filter((p) => !organizationId || p.organizationId === organizationId);

    for (const p of projects) {
      if (p.name.toLowerCase().includes(needle)) {
        hits.push({
          type: "project",
          id: p.id,
          title: p.name,
          subtitle: p.isTemplate ? "template" : p.status,
        });
      }
      for (const t of this.db.getTasks(p.id)) {
        const hay = [t.name, t.wbs, ...(t.tags ?? []), t.description ?? ""].join(" ").toLowerCase();
        if (hay.includes(needle)) {
          hits.push({
            type: "task",
            id: t.id,
            projectId: p.id,
            title: t.name,
            subtitle: `${p.name} · ${t.wbs}`,
          });
        }
      }
    }
    return hits.slice(0, 50);
  }
}
