import { useTranslation } from "react-i18next";
import { Github, Linkedin, Twitter } from "lucide-react";
import { NexusLogo } from "./nexus-logo";

const PRODUCT_LINKS = [
  { href: "#features", key: "footerGantt" },
  { href: "#modules", key: "footerEvm" },
  { href: "#modules", key: "footerExcel" },
  { href: "#modules", key: "footerReports" },
] as const;

export function MarketingFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t"
      style={{
        borderColor: "var(--landing-border)",
        background: "var(--landing-footer-bg)",
        color: "var(--landing-footer-fg)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <NexusLogo size="sm" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed opacity-90">{t("landing.footerTagline")}</p>
            <p className="mt-3 text-xs opacity-70">{t("landing.footerStack")}</p>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-300">
              {t("landing.footerProduct")}
            </h4>
            <ul className="space-y-2.5 text-sm">
              {PRODUCT_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <a href={href} className="transition-colors hover:text-white">
                    {t(`landing.${key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-300">
              {t("landing.footerTech")}
            </h4>
            <ul className="space-y-2 text-sm opacity-90">
              {(["footerTech1", "footerTech2", "footerTech3", "footerTech4"] as const).map((key) => (
                <li key={key}>{t(`landing.${key}`)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs opacity-70">
            © {year} NexusProject. {t("landing.footerRights")}
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="opacity-60 transition-opacity hover:opacity-100" aria-label="LinkedIn">
              <Linkedin size={18} />
            </a>
            <a href="#" className="opacity-60 transition-opacity hover:opacity-100" aria-label="Twitter">
              <Twitter size={18} />
            </a>
            <a href="#" className="opacity-60 transition-opacity hover:opacity-100" aria-label="GitHub">
              <Github size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
