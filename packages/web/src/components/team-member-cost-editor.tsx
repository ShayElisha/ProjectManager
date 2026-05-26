import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectMember, Resource } from "@nexus/shared";
import { MemberCostFields } from "@/components/member-cost-fields";
import { Button } from "@/components/ui/button";
import {
  costsPatchFromMode,
  formatMemberCost,
  getMemberCostMode,
  type MemberCostMode,
} from "@/lib/member-cost";
import { useAppStore } from "@/store/app-store";

interface Props {
  member: ProjectMember;
  resource?: Resource;
  compact?: boolean;
}

export function TeamMemberCostEditor({ member, resource, compact }: Props) {
  const { t, i18n } = useTranslation();
  const activeProject = useAppStore((s) => s.activeProject);
  const updateTeamMember = useAppStore((s) => s.updateTeamMember);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<MemberCostMode>("hourly");
  const [amount, setAmount] = useState(250);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const m = getMemberCostMode(resource);
    setMode(m);
    setAmount(
      m === "global"
        ? (resource?.costPerUnit ?? 0)
        : (resource?.costPerHour ?? 250),
    );
  }, [resource]);

  const currency = activeProject?.currency ?? "ILS";
  const display = formatMemberCost(resource, currency, i18n.language);

  const save = async () => {
    setSaving(true);
    try {
      const costs = costsPatchFromMode(mode, amount);
      await updateTeamMember(member.id, costs);
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-start text-sm tabular-nums text-[var(--accent)] hover:underline"
        title={t("team.editCost")}
      >
        {display}
      </button>
    );
  }

  return (
    <div className={compact ? "mt-2 space-y-2" : "space-y-2"}>
      <MemberCostFields
        compact
        mode={mode}
        amount={amount}
        onModeChange={setMode}
        onAmountChange={setAmount}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? t("auth.loading") : t("settings.save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          {t("settings.cancel")}
        </Button>
      </div>
    </div>
  );
}
