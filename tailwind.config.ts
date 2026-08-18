/** @type {import('tailwindcss').Config} */

/**
 * Every colour below resolves through a CSS custom property that `globals.css`
 * redefines under `.dark`. That indirection is what makes one set of class names
 * render both themes — a component asks for `bg-surface`, not for a hex, so it
 * never has to know which theme is live.
 *
 * The triplets are stored bare ("250 24% 10%") rather than as full colours so
 * Tailwind can inject its own alpha channel: `bg-surface/60` still works.
 */
const themed = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    fontSize: {
      "heading1-bold": ["36px", { lineHeight: "120%", fontWeight: "700", letterSpacing: "-0.02em" }],
      "heading1-semibold": ["36px", { lineHeight: "120%", fontWeight: "600", letterSpacing: "-0.02em" }],
      "heading2-bold": ["30px", { lineHeight: "120%", fontWeight: "700", letterSpacing: "-0.02em" }],
      "heading2-semibold": ["30px", { lineHeight: "120%", fontWeight: "600", letterSpacing: "-0.02em" }],
      "heading3-bold": ["24px", { lineHeight: "125%", fontWeight: "700", letterSpacing: "-0.015em" }],
      "heading4-medium": ["20px", { lineHeight: "130%", fontWeight: "600", letterSpacing: "-0.01em" }],
      "body-bold": ["18px", { lineHeight: "150%", fontWeight: "700" }],
      "body-semibold": ["18px", { lineHeight: "150%", fontWeight: "600" }],
      "body-medium": ["18px", { lineHeight: "150%", fontWeight: "500" }],
      "body-normal": ["18px", { lineHeight: "150%", fontWeight: "400" }],
      "body1-bold": ["18px", { lineHeight: "150%", fontWeight: "700" }],
      "base-regular": ["16px", { lineHeight: "160%", fontWeight: "400" }],
      "base-medium": ["16px", { lineHeight: "160%", fontWeight: "500" }],
      "base-semibold": ["16px", { lineHeight: "150%", fontWeight: "600" }],
      "base1-semibold": ["16px", { lineHeight: "150%", fontWeight: "600" }],
      "small-regular": ["14px", { lineHeight: "165%", fontWeight: "400" }],
      "small-medium": ["14px", { lineHeight: "150%", fontWeight: "500" }],
      "small-semibold": ["14px", { lineHeight: "150%", fontWeight: "600" }],
      "subtle-medium": ["12px", { lineHeight: "16px", fontWeight: "500" }],
      "subtle-semibold": ["12px", { lineHeight: "16px", fontWeight: "600" }],
      "tiny-medium": ["10px", { lineHeight: "140%", fontWeight: "500" }],
      "x-small-semibold": ["7px", { lineHeight: "9.318px", fontWeight: "600" }],
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
      },
      colors: {
        /* ---- semantic surface + text scale ---- */
        canvas: themed("canvas"),
        surface: themed("surface"),
        "surface-2": themed("surface-2"),
        "surface-3": themed("surface-3"),
        hairline: themed("border-soft"),
        "hairline-strong": themed("border-strong"),
        fg: themed("fg"),
        "fg-muted": themed("fg-muted"),
        "fg-subtle": themed("fg-subtle"),
        "fg-onbrand": themed("fg-onbrand"),

        /* ---- accents ---- */
        brand: themed("brand"),
        "brand-hover": themed("brand-hover"),
        violet: themed("accent-violet"),
        aqua: themed("accent-aqua"),
        danger: themed("danger"),
        success: themed("success"),
        warning: themed("warning"),

        /* ----------------------------------------------------------------
         * Legacy aliases. The original palette was hard-coded for a single
         * dark theme, and dozens of `text-light-1` / `bg-dark-2` usages are
         * spread across the app. Rather than risk missing one and leaving an
         * unreadable white-on-white element in light mode, every old name is
         * repointed at the matching themed token — so anything not yet
         * migrated still flips with the theme.
         * ---------------------------------------------------------------- */
        "primary-500": themed("brand"),
        "secondary-500": themed("warning"),
        blue: themed("accent-aqua"),
        "logout-btn": themed("danger"),
        "dark-1": themed("canvas"),
        "dark-2": themed("surface"),
        "dark-3": themed("surface-2"),
        "dark-4": themed("border-soft"),
        "light-1": themed("fg"),
        "light-2": themed("fg-muted"),
        "light-3": themed("fg-subtle"),
        "light-4": themed("fg-subtle"),
        "gray-1": themed("fg-subtle"),
        glassmorphism: "hsl(var(--glass) / 0.72)",
        "navbar-menu": "hsl(var(--glass) / 0.72)",

        /* ----------------------------------------------------------------
         * shadcn scale. The ui/* primitives were generated against these
         * names but the original config never declared them, so classes like
         * `bg-background` and `border-input` compiled to nothing — which is
         * why every Button and Input rendered unstyled. globals.css aliases
         * each variable onto a Relay token, so they inherit the theme.
         * ---------------------------------------------------------------- */
        background: themed("background"),
        foreground: themed("foreground"),
        border: themed("border"),
        input: themed("input"),
        ring: themed("ring"),
        primary: {
          DEFAULT: themed("primary"),
          foreground: themed("primary-foreground"),
        },
        secondary: {
          DEFAULT: themed("secondary"),
          foreground: themed("secondary-foreground"),
        },
        muted: {
          DEFAULT: themed("muted"),
          foreground: themed("muted-foreground"),
        },
        accent: {
          DEFAULT: themed("accent"),
          foreground: themed("accent-foreground"),
        },
        popover: {
          DEFAULT: themed("popover"),
          foreground: themed("popover-foreground"),
        },
        card: {
          DEFAULT: themed("card"),
          foreground: themed("card-foreground"),
        },
        destructive: {
          DEFAULT: themed("destructive"),
          foreground: themed("destructive-foreground"),
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
        card: "1.375rem",
        pill: "999px",
      },
      boxShadow: {
        /* Layered rather than one blur: a tight contact shadow keeps the edge
         * crisp while the wide one carries the float. */
        soft: "0 1px 2px hsl(var(--shadow) / 0.06), 0 4px 16px -4px hsl(var(--shadow) / 0.08)",
        card: "0 1px 2px hsl(var(--shadow) / 0.05), 0 8px 28px -10px hsl(var(--shadow) / 0.14)",
        lift: "0 2px 4px hsl(var(--shadow) / 0.06), 0 18px 44px -14px hsl(var(--shadow) / 0.24)",
        glass: "inset 0 1px 0 0 hsl(var(--highlight) / 0.07), 0 10px 40px -12px hsl(var(--shadow) / 0.28)",
        glow: "0 0 0 1px hsl(var(--brand) / 0.28), 0 8px 30px -6px hsl(var(--brand) / 0.42)",
        "count-badge": "0 0 0 2px hsl(var(--surface)), 0 4px 12px -2px hsl(var(--brand) / 0.6)",
        "groups-sidebar": "-30px 0 60px 0 hsl(var(--shadow) / 0.18)",
      },
      screens: {
        xs: "400px",
      },
      transitionTimingFunction: {
        /* A slight overshoot on enter reads as physical rather than mechanical. */
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        250: "250ms",
        400: "400ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        /* The like button: a quick squash before the overshoot sells the tap. */
        "heart-pop": {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(0.82)" },
          "70%": { transform: "scale(1.25)" },
          "100%": { transform: "scale(1)" },
        },
        "ring-burst": {
          "0%": { opacity: "0.55", transform: "scale(0.4)" },
          "100%": { opacity: "0", transform: "scale(2.1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        /* Drifts the ambient blobs so the backdrop is never quite static. */
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(4%, -6%, 0) scale(1.08)" },
          "66%": { transform: "translate3d(-5%, 4%, 0) scale(0.95)" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%) scaleX(0.4)" },
          "50%": { transform: "translateX(0%) scaleX(0.7)" },
          "100%": { transform: "translateX(100%) scaleX(0.4)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "slide-down": "slide-down 0.24s cubic-bezier(0.22, 1, 0.36, 1) both",
        "heart-pop": "heart-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "ring-burst": "ring-burst 0.5s ease-out forwards",
        shimmer: "shimmer 1.6s infinite",
        drift: "drift 24s ease-in-out infinite",
        "progress-indeterminate": "progress-indeterminate 1.1s ease-in-out infinite",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
