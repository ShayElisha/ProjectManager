import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, GanttChart, Sparkles } from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)]">
      <div className="marketing-mesh pointer-events-none absolute inset-0" />
      <div className="marketing-orb marketing-orb-1 pointer-events-none" />
      <div className="marketing-orb marketing-orb-2 pointer-events-none" />

      <MarketingNav />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-6 pb-12 pt-24 lg:flex-row lg:gap-16 lg:pt-20">
        <div className="hidden max-w-md flex-1 lg:block">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--accent)]"
          >
            <ArrowRight size={16} className="rotate-180 rtl:rotate-0" />
            {t("landing.backHome")}
          </Link>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300">
            <Sparkles size={14} />
            {t("landing.badge")}
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            {t("landing.heroTitle")}
            <span className="mt-2 block bg-gradient-to-l from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
              {t("landing.heroHighlight")}
            </span>
          </h1>
          <p className="mt-4 text-[var(--muted)] leading-relaxed">{t("landing.heroSub")}</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[t("landing.bullet1"), t("landing.bullet2"), t("landing.bullet3")].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-500">
                  <GanttChart size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="w-full max-w-md flex-1">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-8 shadow-2xl shadow-indigo-500/5 backdrop-blur-xl">
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 border-t border-[var(--border)] pt-6 text-center text-sm">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
