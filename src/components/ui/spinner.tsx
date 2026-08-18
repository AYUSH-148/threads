import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  label?: string;
}

/**
 * Two counter-rotating arcs in the brand gradient's two ends, so an in-flight
 * button still reads as Relay rather than as a generic bootstrap spinner.
 */
export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("relative inline-block h-4 w-4 shrink-0", className)}
    >
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-current opacity-25" />
      <span
        className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-current"
        style={{ animationDuration: "0.7s" }}
      />
    </span>
  );
}

/** Centred spinner for a whole panel that has nothing else to show yet. */
export function PanelSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex w-full items-center justify-center gap-3 py-16 text-fg-subtle">
      <Spinner className="h-5 w-5 text-brand" label={label} />
      <span className="text-small-regular">{label}…</span>
    </div>
  );
}
