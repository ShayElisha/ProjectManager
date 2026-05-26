import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Props {
  size?: "sm" | "md";
  showText?: boolean;
  className?: string;
}

export function NexusLogo({ size = "md", showText = true, className }: Props) {
  const { t } = useTranslation();
  const box = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const letter = size === "sm" ? "text-base" : "text-lg";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative", box)}>
        <div
          className={cn(
            "absolute inset-0 rounded-xl border border-indigo-400/40 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 shadow-lg shadow-indigo-500/30",
            "rotate-[-8deg] scale-95",
          )}
        />
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-xl border border-white/20 bg-slate-900 backdrop-blur-sm dark:bg-slate-950/90",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
          )}
        >
          <span className={cn("font-extrabold tracking-tight text-white", letter)}>N</span>
        </div>
        <div className="absolute -end-1 -top-1 grid grid-cols-2 gap-0.5 opacity-80">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
            />
          ))}
        </div>
      </div>
      {showText && (
        <div>
          <p className="text-sm font-extrabold leading-none tracking-tight sm:text-base text-[var(--landing-fg,var(--fg))]">
            NexusProject
          </p>
          <p className="hidden text-[10px] landing-text-muted sm:block">{t("app.tagline")}</p>
        </div>
      )}
    </div>
  );
}
