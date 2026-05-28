import { create } from "zustand";
import type { AuthUser } from "./auth-types";
import { api } from "@/lib/api";
import { getAccessToken, setAccessToken } from "@/lib/auth-token";

const SESSION_KEY = "nexus_session";

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

function persistSession(user: AuthUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  setAccessToken(null);
}

function readSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,

  hydrate: async () => {
    const cached = readSession();
    const token = getAccessToken();
    if (token) {
      try {
        const me = await api.me();
        const user: AuthUser = {
          id: me.id,
          name: me.name,
          email: me.email,
          organizationId: me.organizationId,
        };
        persistSession(user);
        set({ user, ready: true });
        return;
      } catch {
        clearSession();
      }
    }
    set({ user: cached, ready: true });
  },

  login: async (email, password) => {
    try {
      const { accessToken, user: u } = await api.login(email, password);
      setAccessToken(accessToken);
      const user: AuthUser = {
        id: u.id,
        name: u.name,
        email: u.email,
        organizationId: u.organizationId,
      };
      persistSession(user);
      set({ user });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("INVALID_CREDENTIALS") || msg.includes("401")) {
        throw new Error("INVALID_CREDENTIALS");
      }
      throw err;
    }
  },

  register: async (name, email, password) => {
    try {
      const { accessToken, user: u } = await api.register(name, email, password);
      setAccessToken(accessToken);
      const user: AuthUser = {
        id: u.id,
        name: u.name,
        email: u.email,
        organizationId: u.organizationId,
      };
      persistSession(user);
      set({ user });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("EMAIL_EXISTS") || msg.includes("409")) {
        throw new Error("EMAIL_EXISTS");
      }
      throw err;
    }
  },

  logout: () => {
    clearSession();
    set({ user: null });
  },
}));

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => !!s.user);
}
