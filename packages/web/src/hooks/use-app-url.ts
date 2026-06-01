import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ViewMode } from "@nexus/shared";
import { useAppStore, type AppSection } from "@/store/app-store";

const VIEW_MODES: ViewMode[] = ["gantt", "grid", "kanban", "calendar", "timeline"];

const SECTIONS: AppSection[] = [
  "dashboard",
  "project",
  "team",
  "budget",
  "portfolio",
  "pmo",
  "controls",
  "rejections",
  "work",
  "vendorQuotes",
  "timesheets",
  "reports",
  "settings",
];

function isViewMode(v: string): v is ViewMode {
  return VIEW_MODES.includes(v as ViewMode);
}

function isSection(s: string): s is AppSection {
  return SECTIONS.includes(s as AppSection);
}

/** Keeps Zustand app state in sync with `/app/s/:section` and `/app/p/:projectId/v/:view`. */
export function useAppUrl() {
  const navigate = useNavigate();
  const params = useParams();
  const syncing = useRef(false);

  const section = useAppStore((s) => s.section);
  const view = useAppStore((s) => s.view);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setSection = useAppStore((s) => s.setSection);
  const setView = useAppStore((s) => s.setView);
  const selectProject = useAppStore((s) => s.selectProject);

  useEffect(() => {
    if (syncing.current) return;
    const projectId = params.projectId;
    const viewParam = params.view;
    const sectionParam = params.section;

    if (projectId && viewParam && isViewMode(viewParam)) {
      syncing.current = true;
      if (activeProjectId !== projectId) {
        void selectProject(projectId, { keepSection: true });
      }
      setSection("project");
      setView(viewParam);
      syncing.current = false;
      return;
    }

    if (sectionParam && isSection(sectionParam)) {
      syncing.current = true;
      setSection(sectionParam);
      syncing.current = false;
    }
  }, [params.projectId, params.view, params.section]);

  useEffect(() => {
    if (syncing.current) return;
    let target: string;
    if (section === "project" && activeProjectId) {
      target = `/app/p/${activeProjectId}/v/${view}`;
    } else {
      target = `/app/s/${section}`;
    }
    const current = window.location.pathname;
    if (current !== target && !current.startsWith(target + "/")) {
      syncing.current = true;
      navigate(target, { replace: true });
      syncing.current = false;
    }
  }, [section, view, activeProjectId, navigate]);
}
