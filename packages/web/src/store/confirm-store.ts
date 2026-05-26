import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolver: ((value: boolean) => void) | null;
  busy: boolean;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  confirm: () => Promise<void>;
  cancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolver: null,
  busy: false,

  ask: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options, resolver: resolve, busy: false });
    }),

  confirm: async () => {
    const { resolver } = get();
    set({ busy: true });
    resolver?.(true);
    set({ open: false, options: null, resolver: null, busy: false });
  },

  cancel: () => {
    get().resolver?.(false);
    set({ open: false, options: null, resolver: null, busy: false });
  },
}));
