import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import type { Project, ProjectMember } from "@nexus/shared";
import { TeamService } from "./team.service";

@Controller("projects/:projectId/team")
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  getTeam(@Param("projectId") projectId: string) {
    return this.team.getTeam(projectId);
  }

  @Patch("project")
  updateProject(@Param("projectId") projectId: string, @Body() body: Partial<Project>) {
    return this.team.updateProject(projectId, body);
  }

  @Post("members")
  addMember(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      name: string;
      email?: string;
      role: ProjectMember["role"];
      costPerHour?: number;
      costPerUnit?: number;
      hoursPerDay?: number;
    },
  ) {
    return this.team.addMember(projectId, body);
  }

  @Patch("members/:memberId")
  updateMember(
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
    @Body()
    body: {
      role?: ProjectMember["role"];
      hoursPerDay?: number;
      costPerHour?: number | null;
      costPerUnit?: number | null;
      name?: string;
      email?: string;
    },
  ) {
    return this.team.updateMember(projectId, memberId, body);
  }

  @Post("tasks/:taskId/assign")
  assign(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() body: { resourceId: string; workHours: number; units?: number },
  ) {
    return this.team.assignToTask(projectId, taskId, body.resourceId, body.workHours, body.units);
  }
}
