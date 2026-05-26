import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, Download, Layers, Settings, Link2 } from "lucide-react";
import type { DependencyType } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { exportProjectToExcel } from "@/lib/project-excel";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog } from "@/components/create-task-dialog";

export function ProjectToolbar() {
  const { t } = useTranslation();
  const baselines = useAppStore((s) => s.baselines);
  const saveBaseline = useAppStore((s) => s.saveBaseline);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeProject = useAppStore((s) => s.activeProject);
  const selectProject = useAppStore((s) => s.selectProject);
  const importProject = useAppStore((s) => s.importProject);
  const view = useAppStore((s) => s.view);
  const setProjectSettingsOpen = useAppStore((s) => s.setProjectSettingsOpen);
  const linkMode = useAppStore((s) => s.linkMode);
  const setLinkMode = useAppStore((s) => s.setLinkMode);
  const defaultLinkType = useAppStore((s) => s.defaultLinkType);
  const setDefaultLinkType = useAppStore((s) => s.setDefaultLinkType);
  const linkLagDays = useAppStore((s) => s.linkLagDays);
  const setLinkLagDays = useAppStore((s) => s.setLinkLagDays);
  const createOpen = useAppStore((s) => s.createTaskDialogOpen);
  const setCreateOpen = useAppStore((s) => s.setCreateTaskDialogOpen);
  const fileRef = useRef<HTMLInputElement>(null);

  const linkTypes: DependencyType[] = ["FS", "SS", "FF", "SF"];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setProjectSettingsOpen(true)}>
          <Settings size={14} />
          {t("actions.projectSettings")}
        </Button>
        {view === "gantt" && (
          <>
            <Button
              variant={linkMode ? "default" : "outline"}
              size="sm"
              onClick={() => setLinkMode(!linkMode)}
            >
              <Link2 size={14} />
              {linkMode ? t("actions.linkModeOff") : t("actions.linkTasks")}
            </Button>
            {linkMode && (
              <>
                <select
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
                  value={defaultLinkType}
                  onChange={(e) => setDefaultLinkType(e.target.value as DependencyType)}
                >
                  {linkTypes.map((lt) => (
                    <option key={lt} value={lt}>
                      {t(`dependencies.${lt}`)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-sm text-[var(--muted)]">
                  {t("actions.lagDays")}
                  <input
                    type="number"
                    className="w-14 rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5 text-sm"
                    value={linkLagDays}
                    onChange={(e) => setLinkLagDays(Number(e.target.value))}
                  />
                </label>
              </>
            )}
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} />
          {t("actions.addTask")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void saveBaseline(`Baseline ${baselines.length}`)}
        >
          <Save size={14} />
          {t("actions.saveBaseline")}
          {baselines.length > 0 && (
            <span className="ms-1 rounded bg-[var(--accent)]/20 px-1.5 text-xs">
              {baselines.length}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!activeProjectId}
          onClick={async () => {
            if (!activeProjectId) return;
            try {
              const payload = await api.exportProjectPayload(activeProjectId);
              exportProjectToExcel(payload, activeProject?.name ?? activeProjectId);
            } catch (err) {
              toast.errorMessage(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <Download size={14} />
          {t("actions.export")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importProject(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!activeProjectId}
          onClick={() => fileRef.current?.click()}
        >
          {t("actions.import")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (!activeProjectId) return;
            await api.generateDemoTasks(activeProjectId, 1000);
            await selectProject(activeProjectId);
          }}
          disabled={!activeProjectId}
        >
          <Layers size={14} />
          {t("actions.loadDemo1k")}
        </Button>
      </div>

      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
