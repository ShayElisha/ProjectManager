import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Bold, Italic, List } from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ value, onChange }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  const exec = (cmd: string) => {
    document.execCommand(cmd, false);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button type="button" className="rounded p-1 hover:bg-[var(--border)]" onClick={() => exec("bold")} aria-label={t("features.bold")}>
          <Bold size={16} />
        </button>
        <button type="button" className="rounded p-1 hover:bg-[var(--border)]" onClick={() => exec("italic")} aria-label={t("features.italic")}>
          <Italic size={16} />
        </button>
        <button type="button" className="rounded p-1 hover:bg-[var(--border)]" onClick={() => exec("insertUnorderedList")} aria-label={t("features.list")}>
          <List size={16} />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[80px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
      />
    </div>
  );
}
