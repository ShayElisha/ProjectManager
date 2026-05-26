import { v4 as uuid } from "uuid";
import type {
  Project,
  Task,
  TaskDependency,
  Resource,
  ResourceAssignment,
} from "@nexus/shared";

export interface SeedPayload {
  organizationId: string;
  organizationName: string;
  projects: Project[];
  tasks: Map<string, Task[]>;
  dependencies: Map<string, TaskDependency[]>;
  resources: Resource[];
  assignments: Map<string, ResourceAssignment[]>;
}

/** Empty org only — no demo projects or tasks. */
export function buildSeedData(): SeedPayload {
  return {
    organizationId: uuid(),
    organizationName: "My Organization",
    projects: [],
    tasks: new Map(),
    dependencies: new Map(),
    resources: [],
    assignments: new Map(),
  };
}
