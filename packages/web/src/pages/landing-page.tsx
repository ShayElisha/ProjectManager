import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  Calendar,
  Columns3,
  FileSpreadsheet,
  GanttChart,
  GitBranch,
  Layers,
  Pause,
  Play,
  Sparkles,
  Users,
  Zap,
  Radio,
  Grid3x3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

const CAPABILITIES = [
  "capGantt",
  "capCpm",
  "capEvm",
  "capRtl",
  "capExcel",
  "capAi",
  "capPortfolio",
  "capWs",
] as const;

const MODULES = [
  { icon: GanttChart, key: "modGantt" },
  { icon: Grid3x3, key: "modGrid" },
  { icon: Columns3, key: "modKanban" },
  { icon: Calendar, key: "modCalendar" },
  { icon: GitBranch, key: "modTimeline" },
  { icon: Briefcase, key: "modPortfolio" },
  { icon: Users, key: "modTeam" },
  { icon: BarChart3, key: "modReports" },
  { icon: FileSpreadsheet, key: "modExcel" },
  { icon: Sparkles, key: "modAi" },
  { icon: Radio, key: "modRealtime" },
  { icon: Layers, key: "modBaseline" },
] as const;

const USE_CASES = ["useCase1", "useCase2", "useCase3"] as const;

export function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const onEmailCta = (e: React.FormEvent) => {
    e.preventDefault();
    const q = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : "";
    navigate(`/register${q}`);
  };

  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden">
      <div className="landing-hero-gradient pointer-events-none fixed inset-0" />
      <div className="marketing-mesh pointer-events-none fixed inset-0 opacity-40 dark:opacity-60" />
      <div className="marketing-grid pointer-events-none fixed inset-0 opacity-[0.2] dark:opacity-[0.12]" />

      <MarketingNav />

      {/* Hero */}
      <section className="relative px-4 pb-20 pt-28 sm:px-6 sm:pt-32 md:pb-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="landing-badge animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold">
            <Sparkles size={14} />
            {t("landing.badge")}
          </div>

          <h1 className="animate-fade-up animation-delay-100 text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            {t("landing.heroTitle")}
          </h1>

          <p className="animate-fade-up animation-delay-200 mx-auto mt-6 max-w-2xl text-base leading-relaxed landing-text-muted sm:text-lg md:text-xl">
            {t("landing.heroSub")}
          </p>

          <div className="animate-fade-up animation-delay-300 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button className="landing-cta-neon h-13 px-8 text-base font-semibold" asChild>
              <Link to="/register">
                {t("landing.ctaPrimary")}
                <ArrowLeft size={18} className="rtl:rotate-180" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-13 landing-border bg-transparent px-8 text-base hover:bg-[var(--landing-glass-hover)]"
              asChild
            >
              <a href="#features">
                <Play size={16} className="me-1 fill-current" />
                {t("landing.ctaDemo")}
              </a>
            </Button>
          </div>
          <p className="animate-fade-up animation-delay-400 mt-4 text-xs landing-text-muted">
            {t("landing.ctaNote")}
          </p>
        </div>

        <div className="animate-fade-up animation-delay-500 relative mt-14 sm:mt-20">
          <DashboardMockup />
        </div>
      </section>

      {/* Capability strip */}
      <section
        id="capabilities"
        className="border-y py-10 backdrop-blur-sm"
        style={{ borderColor: "var(--landing-border)", background: "var(--landing-section-alt)" }}
      >
        <p className="mb-8 text-center text-sm landing-text-muted">{t("landing.capabilitiesTitle")}</p>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 sm:gap-4">
          {CAPABILITIES.map((key) => (
            <span key={key} className="landing-cap-chip rounded-full px-4 py-2 text-sm font-semibold">
              {t(`landing.${key}`)}
            </span>
          ))}
        </div>
      </section>

      {/* Bento — core product features */}
      <section id="features" className="relative px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center md:mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.featuresTitle")}</h2>
            <p className="mx-auto mt-3 max-w-2xl landing-text-muted">{t("landing.featuresSub")}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
            <div className="landing-glass-card group relative overflow-hidden rounded-3xl p-6 md:col-span-2 lg:row-span-2">
              <GanttChart className="mb-3 text-indigo-500" size={24} />
              <h3 className="text-xl font-bold">{t("landing.bentoGanttTitle")}</h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed landing-text-muted">
                {t("landing.bentoGanttDesc")}
              </p>
              <ul className="mt-4 space-y-2 text-sm landing-text-muted">
                {(["bentoGantt1", "bentoGantt2", "bentoGantt3", "bentoGantt4"] as const).map((k) => (
                  <li key={k} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                    {t(`landing.${k}`)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="landing-glass-card rounded-3xl p-6">
              <BarChart3 className="mb-3 text-violet-500" size={22} />
              <h3 className="text-lg font-bold">{t("landing.bentoEvmTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed landing-text-muted">{t("landing.bentoEvmDesc")}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                {["PV", "EV", "AC", "CPI"].map((m) => (
                  <div
                    key={m}
                    className="rounded-lg border py-2 font-mono font-bold"
                    style={{ borderColor: "var(--landing-border)" }}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-glass-card rounded-3xl p-6">
              <Users className="mb-3 text-cyan-500" size={22} />
              <h3 className="text-lg font-bold">{t("landing.bentoResourcesTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed landing-text-muted">{t("landing.bentoResourcesDesc")}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full opacity-15" style={{ background: "var(--landing-fg)" }}>
                <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-red-500 to-indigo-500" />
              </div>
              <p className="mt-2 text-[10px] landing-text-muted">{t("landing.bentoResourcesHint")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* All modules grid */}
      <section id="modules" className="px-4 py-20 sm:px-6" style={{ background: "var(--landing-section-alt)" }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{t("landing.modulesTitle")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center landing-text-muted">{t("landing.modulesSub")}</p>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MODULES.map(({ icon: Icon, key }) => (
              <div key={key} className="landing-module-card flex gap-3 rounded-2xl p-4 transition-shadow hover:shadow-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{t(`landing.${key}Title`)}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed landing-text-muted">{t(`landing.${key}Desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why / product strengths */}
      <section id="use-cases" className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{t("landing.whyTitle")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center landing-text-muted">{t("landing.whySub")}</p>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {USE_CASES.map((key) => (
              <article key={key} className="landing-glass-card rounded-2xl p-6">
                <div className="mb-4 inline-flex rounded-xl bg-indigo-500/10 p-2.5 text-indigo-600 dark:text-indigo-400">
                  {key === "useCase1" && <Pause size={20} />}
                  {key === "useCase2" && <Briefcase size={20} />}
                  {key === "useCase3" && <FileSpreadsheet size={20} />}
                </div>
                <h3 className="font-semibold">{t(`landing.${key}Title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed landing-text-muted">{t(`landing.${key}Desc`)}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(["whyRtl", "whyPerf", "whyExcel", "whyStack"] as const).map((key) => (
              <div
                key={key}
                className="rounded-2xl border p-4 text-center"
                style={{ borderColor: "var(--landing-border)", background: "var(--landing-glass)" }}
              >
                <p className="text-sm font-semibold">{t(`landing.${key}Title`)}</p>
                <p className="mt-1 text-xs landing-text-muted">{t(`landing.${key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI highlight */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="landing-glass-card mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl p-8 text-center sm:flex-row sm:text-start md:p-10">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-fuchsia-500/20">
            <Zap size={32} className="text-amber-500 landing-spark-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{t("landing.aiBlockTitle")}</h3>
            <p className="mt-2 text-sm leading-relaxed landing-text-muted">{t("landing.aiBlockDesc")}</p>
          </div>
          <Button className="landing-cta-neon shrink-0" asChild>
            <Link to="/register">{t("landing.navCta")}</Link>
          </Button>
        </div>
      </section>

      {/* Final CTA */}
      <section id="start" className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="landing-cta-box relative mx-auto max-w-4xl overflow-hidden rounded-3xl border px-6 py-14 text-center sm:px-12 sm:py-16 landing-border">
          <div className="landing-cta-box-inner pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -top-24 start-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          <h2 className="relative text-3xl font-bold sm:text-4xl">{t("landing.ctaBlockTitle")}</h2>
          <p className="relative mx-auto mt-4 max-w-lg landing-text-muted">{t("landing.ctaBlockSub")}</p>
          <form onSubmit={onEmailCta} className="relative mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("landing.ctaEmailPlaceholder")}
              className="landing-email-input h-12 flex-1 rounded-xl px-4 text-sm focus:border-indigo-400/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <Button type="submit" className="landing-cta-neon h-12 shrink-0 px-8 font-semibold">
              {t("landing.ctaBlockButton")}
            </Button>
          </form>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
