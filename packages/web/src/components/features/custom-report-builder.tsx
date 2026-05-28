import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomReport, ReportWidgetType } from "@nexus/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

const WIDGETS: ReportWidgetType[] = ["status", "resources", "cashflow", "task_list"];

interface Props {
  projectId: string;
  selected: ReportWidgetType[];
  onSelectedChange: (w: ReportWidgetType[]) => void;
}

export function CustomReportBuilder({ projectId, selected, onSelectedChange }: Props) {
  const { t } = useTranslation();
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setReports(await api.customReports(projectId));
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (w: ReportWidgetType) => {
    onSelectedChange(selected.includes(w) ? selected.filter((x) => x !== w) : [...selected, w]);
  };

  const save = async () => {
    if (!name.trim() || selected.length === 0) return;
    await api.createCustomReport(projectId, { name: name.trim(), widgets: selected });
    setName("");
    toast.success(t("reports.customSaved"));
    await load();
  };

  const apply = (r: CustomReport) => {
    onSelectedChange(r.widgets);
    toast.info(t("reports.customApplied", { name: r.name }));
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="mb-3 text-sm font-semibold">{t("reports.customBuilder")}</h3>
      <div className="flex flex-wrap gap-2">
        {WIDGETS.map((w) => (
          <label key={w} className="inline-flex items-center gap-1 text-sm">
            <input type="checkbox" checked={selected.includes(w)} onChange={() => toggle(w)} />
            {t(`reports.widget.${w}`)}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="min-w-[8rem] flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
          placeholder={t("reports.customName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => void save()}>
          {t("reports.saveCustom")}
        </Button>
      </div>
      {reports.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {reports.map((r) => (
            <li key={r.id}>
              <button type="button" className="text-[var(--accent)] hover:underline" onClick={() => apply(r)}>
                {r.name}
              </button>
              <span className="ms-2 text-[var(--muted)]">({r.widgets.join(", ")})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
