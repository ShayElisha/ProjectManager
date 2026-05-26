import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useConfirmStore } from "@/store/confirm-store";
import { cn } from "@/lib/utils";

export function ConfirmSheet() {
  const { t } = useTranslation();
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const busy = useConfirmStore((s) => s.busy);
  const confirm = useConfirmStore((s) => s.confirm);
  const cancel = useConfirmStore((s) => s.cancel);

  if (!options) return null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) cancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-sheet-overlay fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "confirm-sheet-content fixed inset-x-0 bottom-0 z-[101] mx-auto max-w-lg",
            "rounded-t-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[var(--border)]" aria-hidden />
          <div className="px-5 pb-4 pt-3">
            <Dialog.Title className="text-lg font-semibold">{options.title}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {options.message}
            </Dialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="sm:min-w-[7rem]" disabled={busy} onClick={cancel}>
                {options.cancelLabel ?? t("confirm.cancel")}
              </Button>
              <Button
                className={cn("sm:min-w-[7rem]", options.destructive && "bg-red-600 hover:bg-red-700")}
                disabled={busy}
                onClick={() => void confirm()}
              >
                {options.confirmLabel ?? t("confirm.ok")}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
