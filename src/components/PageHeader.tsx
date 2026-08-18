import Icon, { type IconName } from "./ui/Icon";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Right-aligned control — a "mark all read" button, a filter, etc. */
  action?: React.ReactNode;
}

/**
 * Every route opened with a bare `<h1 className="head-text">`, so the pages had
 * no shared shape and nothing distinguished one from the next. One header gives
 * them a common rhythm and a place to hang per-page actions.
 */
function PageHeader({ title, subtitle, icon, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex animate-fade-up items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-fg-onbrand shadow-soft"
            style={{
              backgroundImage:
                "linear-gradient(135deg, hsl(var(--accent-violet)), hsl(var(--brand)) 75%)",
            }}
          >
            <Icon name={icon} className="h-5 w-5" strokeWidth={2.2} />
          </span>
        )}

        <div className="min-w-0">
          <h1 className="head-text truncate">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-small-regular text-fg-subtle">{subtitle}</p>
          )}
        </div>
      </div>

      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}

export default PageHeader;
