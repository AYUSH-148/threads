import Link from "next/link";

import Icon, { type IconName } from "./ui/Icon";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

/**
 * Replaces the bare "No Result" / "No threads found" paragraphs. An empty feed
 * is the one screen most likely to be a new user's first, so it should point
 * somewhere rather than read as a failure.
 */
function EmptyState({ icon = "search", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex animate-fade-up flex-col items-center rounded-card border border-dashed border-hairline bg-surface/50 px-6 py-14 text-center">
      <span
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-brand"
        style={{ backgroundColor: "hsl(var(--brand) / 0.12)" }}
      >
        <Icon name={icon} className="h-6 w-6" strokeWidth={1.9} />
      </span>

      <h3 className="font-display text-base-semibold text-fg">{title}</h3>

      {description && (
        <p className="mt-1.5 max-w-sm text-small-regular text-fg-subtle">
          {description}
        </p>
      )}

      {action && (
        <Link href={action.href} className="btn-brand mt-6 px-5 py-2.5">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export default EmptyState;
