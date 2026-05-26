import { create } from "zustand";
import type {
  ApprovalStep,
  CostBaseline,
  NegotiationEntry,
  QuoteStatus,
  VendorComparison,
  VendorCriterion,
  VendorQuote,
  VendorRfq,
} from "@nexus/shared";
import { runAutoScoring } from "@nexus/shared";

const STORAGE_KEY = "nexus-vendor-quotes-v2";

function uid(): string {
  return crypto.randomUUID();
}

function defaultCriteria(): VendorCriterion[] {
  return [
    { id: uid(), name: "מחיר", weight: 40, autoFromPrice: true },
    { id: uid(), name: "איכות", weight: 30 },
    { id: uid(), name: "זמן אספקה", weight: 20 },
    { id: uid(), name: "שירות", weight: 10 },
  ];
}

function defaultCostBaseline(): CostBaseline {
  return { budgetBaseline: 0, actualCost: 0, ev: 0, pv: 0, ac: 0 };
}

function defaultApproval(): ApprovalStep[] {
  return [
    { id: uid(), role: "מנהל רכש", status: "pending" },
    { id: uid(), role: "מנהל פרויקט", status: "pending" },
    { id: uid(), role: "הנהלה", status: "pending" },
  ];
}

function newRfq(title?: string): VendorRfq {
  const n = Date.now().toString(36).toUpperCase().slice(-6);
  return {
    id: uid(),
    rfqNumber: `RFQ-${n}`,
    title: title ?? "בקשת הצעת מחיר",
    description: "",
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString().slice(0, 10),
    status: "draft",
  };
}

function defaultVendors(criteria: VendorCriterion[]): VendorQuote[] {
  const scores = Object.fromEntries(criteria.map((c) => [c.id, 0]));
  return [
    {
      id: uid(),
      name: "ספק א׳",
      quotedPrice: 0,
      status: "pending",
      deliveryDays: 14,
      scores: { ...scores },
      negotiationHistory: [],
    },
    {
      id: uid(),
      name: "ספק ב׳",
      quotedPrice: 0,
      status: "pending",
      deliveryDays: 10,
      scores: { ...scores },
      negotiationHistory: [],
    },
  ];
}

export function newComparison(name: string): VendorComparison {
  const criteria = defaultCriteria();
  return {
    id: uid(),
    name,
    rfq: newRfq(name),
    criteria,
    vendors: defaultVendors(criteria),
    approvalWorkflow: defaultApproval(),
    costBaseline: defaultCostBaseline(),
    selectedVendorId: null,
    updatedAt: new Date().toISOString(),
  };
}

function migrateLegacy(raw: unknown): VendorComparison[] {
  if (!Array.isArray(raw) || raw.length === 0) return [newComparison("השוואת הצעות 1")];
  return raw.map((item: Record<string, unknown>) => {
    if (item.rfq && item.approvalWorkflow) return item as unknown as VendorComparison;
    const criteria = (item.criteria as VendorCriterion[]) ?? defaultCriteria();
    const vendors = ((item.vendors as VendorQuote[]) ?? []).map((v) => ({
      ...v,
      quotedPrice: v.quotedPrice ?? 0,
      status: (v.status as QuoteStatus) ?? "pending",
      deliveryDays: v.deliveryDays ?? 14,
      negotiationHistory: v.negotiationHistory ?? [],
    }));
    return {
      id: String(item.id ?? uid()),
      name: String(item.name ?? "RFQ"),
      rfq: newRfq(String(item.name)),
      criteria,
      vendors: vendors.length ? vendors : defaultVendors(criteria),
      approvalWorkflow: defaultApproval(),
      costBaseline: defaultCostBaseline(),
      selectedVendorId: null,
      updatedAt: String(item.updatedAt ?? new Date().toISOString()),
    };
  });
}

function loadFromStorage(): VendorComparison[] {
  try {
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) {
      const parsed = JSON.parse(v2) as unknown;
      return migrateLegacy(parsed);
    }
    const legacy = localStorage.getItem("nexus-vendor-quotes");
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown;
      const migrated = migrateLegacy(parsed);
      persist(migrated);
      return migrated;
    }
    return [newComparison("השוואת הצעות 1")];
  } catch {
    return [newComparison("השוואת הצעות 1")];
  }
}

function persist(comparisons: VendorComparison[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(comparisons));
}

function patchActive(
  comparisons: VendorComparison[],
  activeId: string | null,
  fn: (c: VendorComparison) => VendorComparison,
): VendorComparison[] {
  return comparisons.map((c) =>
    c.id === activeId ? { ...fn(c), updatedAt: new Date().toISOString() } : c,
  );
}

interface VendorQuotesState {
  comparisons: VendorComparison[];
  activeId: string | null;
  hydrated: boolean;
  hydrate: () => void;
  setActive: (id: string) => void;
  addComparison: (name?: string) => void;
  removeComparison: (id: string) => void;
  renameComparison: (id: string, name: string) => void;
  updateRfq: (patch: Partial<VendorRfq>) => void;
  addCriterion: () => void;
  updateCriterion: (id: string, patch: Partial<VendorCriterion>) => void;
  removeCriterion: (id: string) => void;
  addVendor: () => void;
  updateVendor: (id: string, patch: Partial<VendorQuote>) => void;
  setVendorScore: (vendorId: string, criterionId: string, score: number) => void;
  setVendorStatus: (vendorId: string, status: QuoteStatus) => void;
  removeVendor: (id: string) => void;
  runAutoScoring: () => void;
  addNegotiationEntry: (vendorId: string, entry: Omit<NegotiationEntry, "id" | "at">) => void;
  updateApprovalStep: (stepId: string, patch: Partial<ApprovalStep>) => void;
  updateCostBaseline: (patch: Partial<CostBaseline>) => void;
  selectVendor: (vendorId: string | null) => void;
}

export const useVendorQuotesStore = create<VendorQuotesState>((set, get) => ({
  comparisons: [],
  activeId: null,
  hydrated: false,

  hydrate: () => {
    const comparisons = loadFromStorage();
    set({ comparisons, activeId: comparisons[0]?.id ?? null, hydrated: true });
  },

  setActive: (id) => set({ activeId: id }),

  addComparison: (name) => {
    const c = newComparison(name ?? `RFQ ${get().comparisons.length + 1}`);
    const comparisons = [...get().comparisons, c];
    persist(comparisons);
    set({ comparisons, activeId: c.id });
  },

  removeComparison: (id) => {
    const comparisons = get().comparisons.filter((c) => c.id !== id);
    if (comparisons.length === 0) {
      const c = newComparison("השוואת הצעות 1");
      persist([c]);
      set({ comparisons: [c], activeId: c.id });
      return;
    }
    const activeId = get().activeId === id ? comparisons[0]!.id : get().activeId;
    persist(comparisons);
    set({ comparisons, activeId });
  },

  renameComparison: (id, name) => {
    const comparisons = get().comparisons.map((c) =>
      c.id === id ? { ...c, name, updatedAt: new Date().toISOString() } : c,
    );
    persist(comparisons);
    set({ comparisons });
  },

  updateRfq: (patch) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      rfq: { ...c.rfq, ...patch },
    }));
    persist(comparisons);
    set({ comparisons });
  },

  addCriterion: () => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => {
      const crit: VendorCriterion = { id: uid(), name: "קריטריון חדש", weight: 0 };
      const vendors = c.vendors.map((v) => ({
        ...v,
        scores: { ...v.scores, [crit.id]: 0 },
      }));
      return { ...c, criteria: [...c.criteria, crit], vendors };
    });
    persist(comparisons);
    set({ comparisons });
  },

  updateCriterion: (id, patch) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      criteria: c.criteria.map((cr) => (cr.id === id ? { ...cr, ...patch } : cr)),
    }));
    persist(comparisons);
    set({ comparisons });
  },

  removeCriterion: (id) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      criteria: c.criteria.filter((cr) => cr.id !== id),
      vendors: c.vendors.map((v) => {
        const { [id]: _, ...scores } = v.scores;
        return { ...v, scores };
      }),
    }));
    persist(comparisons);
    set({ comparisons });
  },

  addVendor: () => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => {
      const scores = Object.fromEntries(c.criteria.map((cr) => [cr.id, 0]));
      const n = c.vendors.length + 1;
      return {
        ...c,
        vendors: [
          ...c.vendors,
          {
            id: uid(),
            name: `ספק ${String.fromCharCode(64 + n)}`,
            quotedPrice: 0,
            status: "pending" as QuoteStatus,
            deliveryDays: 14,
            scores,
            negotiationHistory: [],
          },
        ],
      };
    });
    persist(comparisons);
    set({ comparisons });
  },

  updateVendor: (id, patch) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      vendors: c.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
    persist(comparisons);
    set({ comparisons });
  },

  setVendorScore: (vendorId, criterionId, score) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      vendors: c.vendors.map((v) =>
        v.id === vendorId
          ? { ...v, scores: { ...v.scores, [criterionId]: score } }
          : v,
      ),
    }));
    persist(comparisons);
    set({ comparisons });
  },

  setVendorStatus: (vendorId, status) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      vendors: c.vendors.map((v) => (v.id === vendorId ? { ...v, status } : v)),
    }));
    persist(comparisons);
    set({ comparisons });
  },

  removeVendor: (id) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      vendors: c.vendors.filter((v) => v.id !== id),
      selectedVendorId: c.selectedVendorId === id ? null : c.selectedVendorId,
    }));
    persist(comparisons);
    set({ comparisons });
  },

  runAutoScoring: () => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) =>
      runAutoScoring(c),
    );
    persist(comparisons);
    set({ comparisons });
  },

  addNegotiationEntry: (vendorId, entry) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      vendors: c.vendors.map((v) =>
        v.id === vendorId
          ? {
              ...v,
              negotiationHistory: [
                {
                  id: uid(),
                  at: new Date().toISOString(),
                  ...entry,
                },
                ...v.negotiationHistory,
              ],
              ...(entry.price != null ? { quotedPrice: entry.price } : {}),
            }
          : v,
      ),
    }));
    persist(comparisons);
    set({ comparisons });
  },

  updateApprovalStep: (stepId, patch) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      approvalWorkflow: c.approvalWorkflow.map((s) =>
        s.id === stepId
          ? {
              ...s,
              ...patch,
              decidedAt: patch.status && patch.status !== "pending" ? new Date().toISOString() : s.decidedAt,
            }
          : s,
      ),
    }));
    persist(comparisons);
    set({ comparisons });
  },

  updateCostBaseline: (patch) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      costBaseline: { ...c.costBaseline, ...patch },
    }));
    persist(comparisons);
    set({ comparisons });
  },

  selectVendor: (vendorId) => {
    const comparisons = patchActive(get().comparisons, get().activeId, (c) => ({
      ...c,
      selectedVendorId: vendorId,
    }));
    persist(comparisons);
    set({ comparisons });
  },
}));
