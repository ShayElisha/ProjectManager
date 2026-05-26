import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { NexusLogo } from "./nexus-logo";

const NAV_LINKS = [
  { href: "#features", key: "navFeatures" },
  { href: "#modules", key: "navModules" },
  { href: "#use-cases", key: "navUseCases" },
  { href: "#start", key: "navStart" },
] as const;

export function MarketingNav() {
  const { t } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const user = useAuthStore((s) => s.user);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "landing-nav fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 transition-all duration-300",
          scrolled && "pt-2",
        )}
      >
        <div
          className={cn(
            "landing-nav-bar flex w-full max-w-6xl items-center justify-between gap-4 rounded-2xl border px-4 py-2.5 backdrop-blur-xl transition-all duration-300 sm:px-6",
            scrolled && "shadow-lg shadow-black/5 dark:shadow-black/25",
          )}
        >
          <Link to="/" className="shrink-0" onClick={() => setMobileOpen(false)}>
            <NexusLogo size="sm" />
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map(({ href, key }) => (
              <a key={key} href={href} className="landing-nav-link rounded-lg px-3 py-2 text-sm font-medium">
                {t(`landing.${key}`)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 landing-text-muted hover:text-[var(--landing-fg)]"
              onClick={toggleTheme}
              aria-label={t("actions.toggleTheme")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden landing-text-muted hover:text-[var(--landing-fg)] sm:inline-flex"
              onClick={() => setLocale(locale === "he" ? "en" : "he")}
            >
              {t("actions.toggleLocale")}
            </Button>
            {user ? (
              <Button size="sm" className="landing-cta-neon text-xs sm:text-sm" asChild>
                <Link to="/app">{t("landing.goToApp")}</Link>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden landing-text-muted hover:text-[var(--landing-fg)] sm:inline-flex"
                  asChild
                >
                  <Link to="/login">{t("landing.navLogin")}</Link>
                </Button>
                <Button size="sm" className="landing-cta-neon hidden text-xs sm:inline-flex sm:text-sm" asChild>
                  <Link to="/register">{t("landing.navCta")}</Link>
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden landing-text-muted"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden dark:bg-black/60"
          onClick={() => setMobileOpen(false)}
        >
          <nav
            className="landing-nav-bar absolute inset-x-4 top-20 rounded-2xl border p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_LINKS.map(({ href, key }) => (
              <a
                key={key}
                href={href}
                className="landing-nav-link block rounded-lg px-4 py-3 text-sm font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {t(`landing.${key}`)}
              </a>
            ))}
            <div className="mt-3 flex gap-2 border-t border-[var(--landing-border)] pt-3">
              <Button variant="ghost" size="sm" className="flex-1" onClick={toggleTheme}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setLocale(locale === "he" ? "en" : "he")}>
                {t("actions.toggleLocale")}
              </Button>
            </div>
            {!user && (
              <div className="mt-3 flex flex-col gap-2">
                <Button variant="outline" className="w-full landing-border" asChild>
                  <Link to="/login" onClick={() => setMobileOpen(false)}>
                    {t("landing.navLogin")}
                  </Link>
                </Button>
                <Button className="landing-cta-neon w-full" asChild>
                  <Link to="/register" onClick={() => setMobileOpen(false)}>
                    {t("landing.navCta")}
                  </Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
