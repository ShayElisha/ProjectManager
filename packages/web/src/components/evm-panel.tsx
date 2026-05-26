import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/app-store";
import { EvmDashboard } from "@/components/evm-dashboard";

interface EVMPanelProps {
  overlay?: boolean;
  onClose?: () => void;
}

export function EVMPanel({ overlay = false, onClose }: EVMPanelProps) {
  const { t } = useTranslation();
  const evm = useAppStore((s) => s.evm);
  const activeProject = useAppStore((s) => s.activeProject);
  if (!evm) return null;

  const currency = activeProject?.currency ?? "ILS";

  const content = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("budget.summary")}</h3>
        {overlay && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-[var(--border)]/40"
            aria-label={t("actions.close")}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <EvmDashboard
        evm={evm}
        currency={currency}
        budgetAllocated={evm.budgetAllocated ?? activeProject?.budgetCap}
        totalPlanned={evm.totalPlanned}
        totalActual={evm.totalActual}
        compact
      />
    </>
  );

  if (overlay) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
        <aside className="fixed inset-y-0 end-0 z-50 flex w-[min(100%,20rem)] flex-col overflow-auto border-s border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl lg:hidden">
          {content}
        </aside>
      </>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 overflow-auto border-s border-[var(--border)] p-4 lg:block">
      {content}
    </aside>
  );
}
