/** The three states the toggle cycles through. "system" defers to the OS. */
export type ThemePreference = "light" | "dark" | "system";

/** What "system" actually resolved to — the only two a stylesheet ever sees. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "relay-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Runs blocking in <head>, before the browser paints anything.
 *
 * Without it the server-rendered HTML carries no theme class, so a dark-mode
 * user sees a full white page for one frame before React hydrates and corrects
 * it. Reading localStorage is synchronous, so doing it here costs a fraction of
 * a millisecond and removes the flash entirely.
 *
 * Kept as a string because it has to be inlined via dangerouslySetInnerHTML —
 * a real <script src> would be fetched too late to matter.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var pref = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var resolved = pref === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : pref;
    var root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
    root.dataset.theme = pref;
  } catch (e) {
    /* Private mode can throw on localStorage. Light is the declared default in
       globals.css, so doing nothing here is already correct. */
  }
})();
`;
