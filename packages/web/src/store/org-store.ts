import { create } from "zustand";
import type { Organization } from "@nexus/shared";
import { api } from "@/lib/api";

const ORG_KEY = "nexus_active_org";

interface OrgState {
  organizations: Organization[];
  activeOrganizationId: string | null;
  loading: boolean;
  loadOrganizations: () => Promise<void>;
  setActiveOrganization: (id: string) => void;
  createOrganization: (name: string) => Promise<Organization>;
}

function readActiveOrg(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export const useOrgStore = create<OrgState>((set, get) => ({
  organizations: [],
  activeOrganizationId: readActiveOrg(),
  loading: false,

  loadOrganizations: async () => {
    set({ loading: true });
    try {
      const organizations = await api.organizations();
      let active = get().activeOrganizationId;
      if (!active && organizations[0]) active = organizations[0].id;
      if (active && !organizations.some((o) => o.id === active) && organizations[0]) {
        active = organizations[0].id;
      }
      if (active) localStorage.setItem(ORG_KEY, active);
      set({ organizations, activeOrganizationId: active, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveOrganization: (id) => {
    localStorage.setItem(ORG_KEY, id);
    set({ activeOrganizationId: id });
  },

  createOrganization: async (name) => {
    const org = await api.createOrganization({ name });
    set((s) => ({
      organizations: [...s.organizations, org],
      activeOrganizationId: org.id,
    }));
    localStorage.setItem(ORG_KEY, org.id);
    return org;
  },
}));
