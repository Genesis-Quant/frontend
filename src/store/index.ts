import { create } from "zustand";

import { getCurrentUser, login, register } from "@/assets/lib/auth";
import { themeStorageKey, tokenStorageKey } from "@/assets/lib/settings";

type Theme = "light" | "dark";
type AuthStatus = "idle" | "loading" | "anonymous" | "authenticated";

type AppStore = {
  theme: Theme;
  authStatus: AuthStatus;
  user: ArenaUser | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  restoreSession: () => Promise<void>;
  authenticate: (mode: AuthMode, username: string, password: string) => Promise<void>;
  logout: () => void;
};

const storedTheme: Theme = localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
document.documentElement.dataset.theme = storedTheme;

export const useAppStore = create<AppStore>((set, get) => ({
  theme: storedTheme,
  authStatus: "idle",
  user: null,
  setTheme: (theme) => {
    localStorage.setItem(themeStorageKey, theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  restoreSession: async () => {
    if (get().authStatus !== "idle") return;
    const token = localStorage.getItem(tokenStorageKey);
    if (!token) {
      set({ authStatus: "anonymous", user: null });
      return;
    }
    set({ authStatus: "loading" });
    try {
      set({ authStatus: "authenticated", user: await getCurrentUser() });
    } catch {
      localStorage.removeItem(tokenStorageKey);
      set({ authStatus: "anonymous", user: null });
    }
  },
  authenticate: async (mode, username, password) => {
    const response = await (mode === "login" ? login(username, password) : register(username, password));
    localStorage.setItem(tokenStorageKey, response.access_token);
    set({ authStatus: "authenticated", user: response.user });
  },
  logout: () => {
    localStorage.removeItem(tokenStorageKey);
    set({ authStatus: "anonymous", user: null });
  }
}));
