import { useTranslation } from "react-i18next";
import { BarChart3, Columns3, GanttChart } from "lucide-react";

export function DashboardMockup() {
  const { t } = useTranslation();

  return (
    <div className="landing-mockup-perspective relative mx-auto w-full max-w-5xl px-4">
      <div className="landing-mockup-glow pointer-events-none absolute -inset-8 rounded-[2rem] bg-gradient-to-b from-indigo-500/20 via-violet-500/10 to-transparent blur-3xl dark:from-indigo-500/30" />
      <div
        className="landing-mockup-frame relative overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: "var(--landing-border)",
          background: "var(--landing-mockup-bg)",
          boxShadow: "0 25px 50px -12px rgba(99, 102, 241, 0.15)",
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: "var(--landing-border)", background: "var(--landing-mockup-panel)" }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          <span className="ms-3 text-xs landing-text-muted">{t("landing.previewTitle")}</span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_280px]">
          <div className="border-b p-4 md:border-b-0 md:border-e" style={{ borderColor: "var(--landing-border)" }}>
            <div className="mb-3 flex items-center gap-2 text-xs landing-text-muted">
              <GanttChart size={14} className="text-indigo-500 dark:text-indigo-400" />
              {t("landing.mockGantt")}
            </div>
            <div className="space-y-2">
              {(["previewRow0", "previewRow1", "previewRow2", "previewRow3"] as const).map((key, i) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs"
                  style={{ borderColor: "var(--landing-border)", background: "var(--landing-mockup-panel)" }}
                >
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {["S", "T", "T", "M"][i]}
                  </span>
                  <span className="truncate">{t(`landing.${key}`)}</span>
                </div>
              ))}
            </div>
            <div
              className="relative mt-4 h-36 overflow-hidden rounded-xl"
              style={{ background: "var(--landing-mockup-panel)" }}
            >
              <div className="absolute inset-0 flex">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-1 border-e opacity-30" style={{ borderColor: "var(--landing-border)" }} />
                ))}
              </div>
              <div
                className="landing-bar-animate absolute top-[30%] h-2 rounded-full bg-slate-500 dark:bg-slate-400"
                style={{ insetInlineStart: "6%", width: "45%" }}
              />
              <div
                className="landing-bar-animate absolute top-[52%] h-2 rounded-full bg-indigo-500"
                style={{ insetInlineStart: "14%", width: "38%", animationDelay: "0.4s" }}
              />
              <div
                className="absolute top-[52%] h-2 rounded-full border border-dashed border-amber-500/70 bg-amber-400/50"
                style={{ insetInlineStart: "58%", width: "28%" }}
              />
              <div
                className="absolute inset-y-0 z-10 w-6 bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30"
                style={{ insetInlineStart: "46%" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4">
            <div
              className="col-span-2 rounded-xl border p-3"
              style={{ borderColor: "var(--landing-border)", background: "var(--landing-mockup-panel)" }}
            >
              <div className="mb-2 flex items-center gap-2 text-xs landing-text-muted">
                <Columns3 size={14} className="text-violet-500" />
                {t("landing.mockKanban")}
              </div>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex-1 space-y-1.5">
                    <div className="h-1 rounded-full opacity-20" style={{ background: "var(--landing-fg)" }} />
                    <div
                      className="h-8 rounded-lg border bg-indigo-500/15"
                      style={{ borderColor: "var(--landing-border)", opacity: 1 - i * 0.2 }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--landing-border)", background: "var(--landing-mockup-panel)" }}
            >
              <div className="mb-1 flex items-center gap-1 text-[10px] landing-text-muted">
                <BarChart3 size={12} className="text-fuchsia-500" />
                CPI
              </div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">1.04</p>
            </div>
            <div
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--landing-border)", background: "var(--landing-mockup-panel)" }}
            >
              <div className="mb-1 text-[10px] landing-text-muted">SPI</div>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">0.97</p>
            </div>
            <div className="col-span-2">
              <div className="mb-1 flex justify-between text-[10px] landing-text-muted">
                <span>{t("landing.mockProgress")}</span>
                <span>68%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full opacity-15" style={{ background: "var(--landing-fg)" }}>
                <div className="landing-progress-animate h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
