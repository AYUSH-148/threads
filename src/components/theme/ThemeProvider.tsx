"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  /** What the user picked, which may be "system". */
  theme: ThemePreference;
  /** What "system" currently resolves to — what the page is actually showing. */
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
  /** light → dark → system → light. */
  cycleTheme: () => void;
  /**
   * False until the first effect runs. Anything whose markup differs between
   * themes has to wait for this, or the server HTML and the client's first
   * render disagree and React throws a hydration mismatch.
   */
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyTheme(preference: ThemePreference, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.theme = preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Deliberately not read from localStorage here. This runs during SSR too,
  // where there is no localStorage, and returning anything else on the client
  // would make the first render disagree with the server's. The inline script
  // has already put the right class on <html>; the effect below catches this
  // state up to it.
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). The
      // in-memory preference still works for the session.
    }

    const preference = isThemePreference(stored) ? stored : "system";
    const resolved = preference === "system" ? systemTheme() : preference;

    setThemeState(preference);
    setResolvedTheme(resolved);
    applyTheme(preference, resolved);
    setMounted(true);
  }, []);

  // Only meaningful while the preference is "system" — an explicit choice
  // should not be overridden when the OS flips at sunset.
  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const resolved = media.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme("system", resolved);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    const resolved = next === "system" ? systemTheme() : next;

    setThemeState(next);
    setResolvedTheme(resolved);
    applyTheme(next, resolved);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Same as above — the choice just will not survive a reload.
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, cycleTheme, mounted }),
    [theme, resolvedTheme, setTheme, cycleTheme, mounted]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
