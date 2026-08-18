/**
 * Clerk's own `baseTheme` (light/dark) has to be chosen where the provider is
 * rendered — and the provider must stay a Server Component, because it reads the
 * SSR auth state from request headers. A server render cannot know which theme
 * the browser is about to show.
 *
 * So the theme is not selected at all: Clerk's surfaces are dressed in our own
 * Tailwind classes and CSS variables, both of which resolve against the `.dark`
 * class on <html>. That follows the toggle for free, with no client provider and
 * no flash.
 *
 * `variables` here are only the values Clerk uses for computed colours and
 * geometry, which have to be literals — everything visual lives in the classes
 * and in the `.cl-*` rules at the bottom of globals.css.
 */
// Deliberately un-annotated. Two copies of @clerk/types are installed — one at
// the top level and one nested under @clerk/clerk-react — and their `Appearance`
// types are structurally incompatible. Letting this infer lets it satisfy
// whichever one ClerkProvider resolves to.
export const clerkAppearance = {
  variables: {
    colorPrimary: "#5B4DF0",
    colorDanger: "#E11D48",
    colorSuccess: "#10B981",
    borderRadius: "0.875rem",
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "surface-card !shadow-lift",
    rootBox: "w-full",
    headerTitle: "font-display !text-fg",
    headerSubtitle: "!text-fg-muted",
    socialButtonsBlockButton:
      "!rounded-xl !border-hairline hover:!bg-surface-2 transition-colors duration-200",
    formButtonPrimary:
      "btn-brand !normal-case !tracking-normal !text-small-semibold hover:!brightness-105",
    formFieldInput: "!rounded-xl !border-hairline",
    footerActionLink: "!text-brand hover:!text-brand-hover",
    organizationSwitcherTrigger:
      "!rounded-pill !px-3 !py-1.5 !border !border-hairline hover:!bg-surface-2 transition-colors duration-200",
    userButtonAvatarBox: "!h-8 !w-8",
    avatarBox: "!rounded-full",
  },
};
