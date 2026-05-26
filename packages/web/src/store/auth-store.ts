import { create } from "zustand";
import { registerUser, validateLogin, type StoredUser } from "@/lib/auth-storage";

const SESSION_KEY = "nexus_session";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  hydrate: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

function toAuthUser(u: StoredUser): AuthUser {
  return { id: u.id, name: u.name, email: u.email };
}

function persistSession(user: AuthUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
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

  hydrate: () => {
    set({ user: readSession(), ready: true });
  },

  login: async (email, password) => {
    const stored = validateLogin(email, password);
    const user = toAuthUser(stored);
    persistSession(user);
    set({ user });
  },

  register: async (name, email, password) => {
    const stored = registerUser(name, email, password);
    const user = toAuthUser(stored);
    persistSession(user);
    set({ user });
  },

  logout: () => {
    clearSession();
    set({ user: null });
  },
}));

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => !!s.user);
}
