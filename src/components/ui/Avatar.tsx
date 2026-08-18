import Image from "next/image";

import { cn } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<AvatarSize, { box: string; px: number }> = {
  xs: { box: "h-5 w-5", px: 20 },
  sm: { box: "h-8 w-8", px: 32 },
  md: { box: "h-11 w-11", px: 44 },
  lg: { box: "h-12 w-12", px: 48 },
  xl: { box: "h-20 w-20", px: 80 },
};

interface AvatarProps {
  src: string;
  alt: string;
  size?: AvatarSize;
  /** Wraps the image in the brand gradient halo. Used for the viewer's own avatar. */
  ring?: boolean;
  className?: string;
  priority?: boolean;
}

/**
 * Every avatar in the app goes through here so the ring, the fallback and the
 * sizing stay consistent — previously each caller hand-rolled its own
 * `<Image fill className="rounded-full">` and they had drifted apart.
 */
function Avatar({
  src,
  alt,
  size = "md",
  ring = false,
  className,
  priority = false,
}: AvatarProps) {
  const { box, px } = SIZES[size];

  const image = (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-surface-3",
        box,
        !ring && className
      )}
    >
      {/* A user record can carry an empty image string. next/image throws on an
          empty src, so the placeholder mark stands in rather than crashing the
          whole feed over one bad row. */}
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={px}
          height={px}
          priority={priority}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center text-fg-subtle"
          style={{ fontSize: Math.round(px * 0.42) }}
        >
          {alt.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </span>
  );

  if (!ring) return image;

  return (
    <span className={cn("avatar-ring-brand inline-block shrink-0", className)}>
      <span className="block rounded-full bg-surface p-[1.5px]">{image}</span>
    </span>
  );
}

export default Avatar;
