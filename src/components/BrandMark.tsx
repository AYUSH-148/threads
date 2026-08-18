import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: number;
  className?: string;
  /**
   * SVG gradient ids are document-global. Two marks on one page sharing an id
   * means the second one silently paints with the first one's gradient, so each
   * call site passes its own.
   */
  gradientId?: string;
}

/**
 * Two chevrons handing a baton forward, inside a ring.
 *
 * Inlined rather than served from /logo.svg because the gradient stops are CSS
 * variables — an <img> gets its own document and cannot see them, so the mark
 * would not follow the theme.
 */
function BrandMark({
  size = 30,
  className,
  gradientId = "relayMark",
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="15"
          y1="0"
          x2="15"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="hsl(var(--accent-violet))" />
          <stop offset="0.55" stopColor="hsl(var(--brand))" />
          <stop offset="1" stopColor="hsl(var(--accent-aqua))" />
        </linearGradient>
      </defs>
      <circle
        cx="15"
        cy="15"
        r="13.915"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.17"
      />
      <path
        d="M8 10.8 L12.2 15 L8 19.2"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.4 10.8 L17.6 15 L13.4 19.2"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.6" cy="15" r="1.7" fill={`url(#${gradientId})`} />
    </svg>
  );
}

export default BrandMark;
