"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "./ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const NEXT: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

/**
 * One button cycling light → dark → system rather than a three-way segmented
 * control: the toggle lives in a topbar that also has to fit a search field, a
 * bell and an org switcher on a 400px screen.
 */
function ThemeToggle() {
  const { theme, cycleTheme, mounted } = useTheme();

  // Before mount the real preference is unknown — the inline script has themed
  // the page but this component has not caught up yet. Rendering the eventual
  // icon now would risk showing a sun on a dark page for one frame, so the slot
  // is held empty at the exact final size to avoid a layout shift.
  if (!mounted) {
    return <div className="h-9 w-9 shrink-0" aria-hidden />;
  }

  const Icon = ICONS[theme];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="icon-btn group relative overflow-hidden"
      title={`Theme: ${LABELS[theme]} — switch to ${LABELS[NEXT[theme]]}`}
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${LABELS[NEXT[theme]]}.`}
    >
      {/* Keyed so React remounts the icon on every change, which restarts the
          entry animation instead of silently swapping the glyph. */}
      <Icon
        key={theme}
        className="h-[18px] w-[18px] animate-scale-in transition-transform duration-400 ease-spring group-hover:rotate-[18deg]"
        strokeWidth={2}
      />
    </button>
  );
}

export default ThemeToggle;
