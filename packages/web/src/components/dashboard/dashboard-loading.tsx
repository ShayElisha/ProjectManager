import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

function Shimmer({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("dashboard-shimmer rounded-xl", className)} style={style} />;
}

export function DashboardLoading() {
  const { t } = useTranslation();

  return (
    <div className="dashboard-page dashboard-loading flex flex-col gap-5 pb-8" aria-busy="true">
      <div className="dashboard-loader-hero dashboard-glass relative overflow-hidden rounded-2xl px-6 py-10 sm:px-8">
        <div className="pointer-events-none absolute inset-0 dashboard-loader-glow" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <div className="dashboard-loader-ring relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] dashboard-loader-spin" />
            <LayoutDashboard className="relative text-[var(--accent)]" size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--fg)]">{t("dashboard.loading")}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{t("dashboard.loadingSub")}</p>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="dashboard-loader-dot h-2 w-2 rounded-full bg-[var(--accent)]"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="sr-only">{t("dashboard.loading")}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer
            key={i}
            className="h-[88px]"
            style={{ animationDelay: `${i * 0.06}s` }}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Shimmer className="h-52 lg:col-span-5" />
        <Shimmer className="h-52 lg:col-span-7" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Shimmer className="h-44" />
        <Shimmer className="h-44" />
      </div>

      <Shimmer className="h-28" />

      <div className="grid gap-4 lg:grid-cols-12">
        <Shimmer className="h-40 lg:col-span-3" />
        <Shimmer className="h-40 lg:col-span-5" />
        <Shimmer className="h-40 lg:col-span-4" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Shimmer className="h-48 lg:col-span-4" />
        <Shimmer className="h-48 lg:col-span-5" />
        <Shimmer className="h-48 lg:col-span-3" />
      </div>

      <Shimmer className="h-64" />
    </div>
  );
}
