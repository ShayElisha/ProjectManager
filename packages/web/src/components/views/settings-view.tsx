import { useTranslation } from "react-i18next";
import { useAppStore, type AppSection } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { OrgWorkspacePanel } from "@/components/features/org-workspace-panel";

const MORE_SECTIONS: { id: AppSection; labelKey: string }[] = [
  { id: "timesheets", labelKey: "nav.timesheets" },
  { id: "team", labelKey: "nav.team" },
  { id: "budget", labelKey: "nav.budget" },
  { id: "controls", labelKey: "nav.controls" },
  { id: "rejections", labelKey: "nav.rejections" },
  { id: "vendorQuotes", labelKey: "nav.vendorQuotes" },
];

export function SettingsView() {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);
  const theme = useAppStore((s) => s.theme);
  const setLocale = useAppStore((s) => s.setLocale);
  const setTheme = useAppStore((s) => s.setTheme);
  const setSection = useAppStore((s) => s.setSection);
  const loadPortfolio = useAppStore((s) => s.loadPortfolio);
  const loadTeam = useAppStore((s) => s.loadTeam);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h2 className="text-xl font-semibold">{t("settings.title")}</h2>

      <OrgWorkspacePanel />

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <h3 className="text-sm font-medium text-[var(--muted)]">{t("settings.appearance")}</h3>
        <div className="flex gap-2">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
          >
            {t("settings.light")}
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
          >
            {t("settings.dark")}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <h3 className="text-sm font-medium text-[var(--muted)]">{t("settings.language")}</h3>
        <div className="flex gap-2">
          <Button
            variant={locale === "he" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("he")}
          >
            עברית (RTL)
          </Button>
          <Button
            variant={locale === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("en")}
          >
            English (LTR)
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-3">
        <h3 className="text-sm font-medium text-[var(--muted)]">{t("settings.moreNav")}</h3>
        <div className="flex flex-wrap gap-2">
          {MORE_SECTIONS.map(({ id, labelKey }) => (
            <Button
              key={id}
              variant="outline"
              size="sm"
              onClick={() => {
                setSection(id);
                if (id === "portfolio") void loadPortfolio();
                if (id === "team") void loadTeam();
              }}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-2 text-sm text-[var(--muted)]">
        <h3 className="font-medium text-[var(--fg)]">{t("settings.about")}</h3>
        <p>NexusProject v0.1.0 — Advanced PM (MS Project class)</p>
        <p>{t("settings.storageHint")}</p>
      </section>
    </div>
  );
}
