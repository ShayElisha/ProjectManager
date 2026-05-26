import { useConfirmStore, type ConfirmOptions } from "@/store/confirm-store";

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(options);
}
