import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, AlertTriangle, Info, XCircle } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { api, type AIInsight } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiCopilotProps {
  hasBottomNav?: boolean;
}

export function AiCopilot({ hasBottomNav = false }: AiCopilotProps) {
  const { t } = useTranslation();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const selectProject = useAppStore((s) => s.selectProject);
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      setInsights(await api.analyze(activeProjectId));
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (!activeProjectId || !prompt.trim()) return;
    setLoading(true);
    try {
      const plan = await api.generatePlan(prompt);
      await api.applyPlan(activeProjectId, plan);
      await selectProject(activeProjectId);
      setPrompt("");
    } finally {
      setLoading(false);
    }
  };

  const icon = (s: AIInsight["severity"]) => {
    if (s === "critical") return <XCircle size={16} className="text-red-500" />;
    if (s === "warning") return <AlertTriangle size={16} className="text-amber-500" />;
    return <Info size={16} className="text-[var(--accent)]" />;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) void analyze();
        }}
        className={cn(
          "fixed end-4 z-50 flex h-12 items-center gap-2 rounded-full px-4 shadow-lg transition-all sm:end-6",
          "bg-[var(--accent)] text-white hover:opacity-90",
          hasBottomNav ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-6",
        )}
      >
        <Sparkles size={18} />
        <span className="hidden text-sm font-medium sm:inline">{t("ai.title")}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "fixed end-4 z-50 flex max-h-[70vh] w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl sm:end-6 sm:w-96",
              hasBottomNav
                ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
                : "bottom-20",
            )}
          >
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h3 className="font-semibold">{t("ai.title")}</h3>
              <p className="text-xs text-[var(--muted)]">{t("ai.subtitle")}</p>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {loading && insights.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t("ai.loading")}</p>
              ) : (
                insights.map((ins) => (
                  <div
                    key={ins.id}
                    className="rounded-lg border border-[var(--border)] p-3 text-sm"
                  >
                    <div className="flex gap-2">
                      {icon(ins.severity)}
                      <div>
                        <p className="font-medium">{ins.title}</p>
                        <p className="mt-1 text-[var(--muted)]">{ins.message}</p>
                        {ins.suggestedAction && (
                          <p className="mt-2 text-xs text-[var(--accent)]">{ins.suggestedAction}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--border)] p-4 space-y-2">
              <textarea
                className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                rows={2}
                placeholder={t("ai.promptPlaceholder")}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => void analyze()} disabled={loading}>
                  {t("ai.analyze")}
                </Button>
                <Button size="sm" className="flex-1" onClick={() => void generate()} disabled={loading || !prompt.trim()}>
                  {t("ai.generate")}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
