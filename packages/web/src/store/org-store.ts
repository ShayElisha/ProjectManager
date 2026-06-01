import { create } from "zustand";

/** Minimal org context after feature-gap modules were removed. */
interface OrgState {
  activeOrganizationId: string | null;
  organizations: { id: string; name: string }[];
  loadOrganizations: () => Promise<void>;
  setActiveOrganizationId: (id: string | null) => void;
}

export const useOrgStore = create<OrgState>((set) => ({
  activeOrganizationId: null,
  organizations: [],
  loadOrganizations: async () => {
    set({ organizations: [], activeOrganizationId: null });
  },
  setActiveOrganizationId: (id) => set({ activeOrganizationId: id }),
}));
