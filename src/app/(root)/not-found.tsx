import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex animate-fade-up flex-col items-center rounded-card border border-dashed border-hairline bg-surface/50 px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Compass className="h-6 w-6" strokeWidth={1.9} />
      </span>

      <p className="gradient-text font-display text-heading1-bold">404</p>
      <h2 className="mt-1 font-display text-heading4-medium text-fg">
        Nothing to see here
      </h2>
      <p className="mt-1.5 max-w-sm text-small-regular text-fg-subtle">
        This thread or profile may have been deleted, or the link is wrong.
      </p>

      <Link href="/" className="btn-brand mt-6 px-5 py-2.5">
        Back to the feed
      </Link>
    </div>
  );
}
