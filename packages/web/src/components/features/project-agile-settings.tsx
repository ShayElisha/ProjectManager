import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomColumn, ProjectForm } from "@nexus/shared";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";

export function ProjectAgileSettings() {
  const { t } = useTranslation();
  const projectId = useAppStore((s) => s.activeProjectId);
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [forms, setForms] = useState<ProjectForm[]>([]);
  const [colKey, setColKey] = useState("");
  const [colLabel, setColLabel] = useState("");
  const [formTitle, setFormTitle] = useState("");

  useEffect(() => {
    if (!projectId) return;
    void Promise.all([api.customColumns(projectId), api.projectForms(projectId)]).then(
      ([c, f]) => {
        setColumns(c);
        setForms(f);
      },
    );
  }, [projectId]);

  if (!projectId) return null;

  const addColumn = async () => {
    if (!colKey.trim() || !colLabel.trim()) return;
    const col = await api.createCustomColumn(projectId, {
      key: colKey.trim(),
      label: colLabel.trim(),
      type: "text",
    });
    setColumns((prev) => [...prev, col]);
    setColKey("");
    setColLabel("");
  };

  const addForm = async () => {
    if (!formTitle.trim()) return;
    const form = await api.createProjectForm(projectId, {
      title: formTitle.trim(),
      fields: [
        { key: "name", label: t("task.name"), type: "text", required: true },
        { key: "description", label: t("features.description"), type: "textarea" },
      ],
    });
    setForms((prev) => [...prev, form]);
    setFormTitle("");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] p-4 space-y-3">
        <h4 className="text-sm font-medium">{t("features.customColumns")}</h4>
        <ul className="space-y-1 text-sm">
          {columns.map((c) => (
            <li key={c.id}>
              {c.label} <span className="text-[var(--muted)]">({c.key})</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-[var(--border)] px-2 py-1 text-sm"
            placeholder={t("features.colKey")}
            value={colKey}
            onChange={(e) => setColKey(e.target.value)}
          />
          <input
            className="rounded border border-[var(--border)] px-2 py-1 text-sm"
            placeholder={t("features.colLabel")}
            value={colLabel}
            onChange={(e) => setColLabel(e.target.value)}
          />
          <Button type="button" size="sm" onClick={() => void addColumn()}>
            {t("features.addColumn")}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] p-4 space-y-3">
        <h4 className="text-sm font-medium">{t("features.publicForms")}</h4>
        <ul className="space-y-2 text-sm">
          {forms.map((f) => (
            <li key={f.id} className="flex flex-col gap-1">
              <span className="font-medium">{f.title}</span>
              <a
                href={`/f/${f.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--accent)] hover:underline"
              >
                /f/{f.slug}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-[var(--border)] px-2 py-1 text-sm"
            placeholder={t("features.formTitle")}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
          <Button type="button" size="sm" onClick={() => void addForm()}>
            {t("features.createForm")}
          </Button>
        </div>
      </section>
    </div>
  );
}
