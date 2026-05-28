import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ProjectForm } from "@nexus/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [form, setForm] = useState<ProjectForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    void api.publicForm(slug).then(setForm).catch(() => setError(t("features.formNotFound")));
  }, [slug, t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    try {
      await api.submitPublicForm(slug, values);
      setDone(true);
    } catch {
      setError(t("features.formSubmitError"));
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-lg font-medium text-emerald-600">{t("features.formThanks")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">{form.title}</h1>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {form.fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="text-[var(--muted)]">
              {f.label}
              {f.required ? " *" : ""}
            </span>
            {f.type === "textarea" ? (
              <textarea
                required={f.required}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                rows={3}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            ) : (
              <input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                required={f.required}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <Button type="submit" className="w-full">
          {t("features.formSubmit")}
        </Button>
      </form>
    </div>
  );
}
