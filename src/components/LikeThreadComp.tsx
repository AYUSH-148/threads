"use client";

import { Heart } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { handleLikeToThread } from "@/lib/actions/thread.action";
import { formatCount } from "@/lib/utils";

interface LikeProps {
  threadId: string;
  /**
   * Computed by the feed query. Previously this component received the whole
   * likes array and scanned it for the viewer's id, which meant every like on
   * the thread had to be serialized into the page to answer one boolean.
   */
  likedByMe: boolean;
  likesCount: number;
}

const LikeThreadComp = ({ threadId, likedByMe, likesCount }: LikeProps) => {
  const path = usePathname();
  const [, startTransition] = useTransition();

  // The server is the single source of truth for "have I liked this".
  const likedOnServer = likedByMe;

  // An optimistic override, held only while the action is in flight so the heart
  // reacts instantly. It is dropped the moment the server reports a different
  // value, so the two can never drift apart.
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [lastServerLiked, setLastServerLiked] = useState(likedOnServer);
  const [burstKey, setBurstKey] = useState(0);

  if (lastServerLiked !== likedOnServer) {
    setLastServerLiked(likedOnServer);
    setOptimisticLiked(null);
  }

  const liked = optimisticLiked ?? likedOnServer;

  // The count prop is the server's, which lags the optimistic heart by a
  // round trip. Adjusting it locally keeps the number and the icon from
  // disagreeing for that moment.
  const displayCount = likesCount + (liked === likedOnServer ? 0 : liked ? 1 : -1);

  const handleLike = () => {
    const next = !liked;
    setOptimisticLiked(next);
    // Remounting the ring restarts its animation; only on like, since a burst
    // on unlike would celebrate the wrong thing.
    if (next) setBurstKey((key) => key + 1);

    startTransition(() => {
      // revalidatePath() inside the action re-renders the server components that
      // render this card, so a fresh `likes` prop arrives on its own — calling
      // router.refresh() here would just duplicate that work.
      handleLikeToThread(threadId, path).catch((error) => {
        console.error("Error handling like:", error);
        setOptimisticLiked(null); // fall back to whatever the server says
      });
    });
  };

  return (
    <button
      type="button"
      onClick={handleLike}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this thread" : "Like this thread"}
      className={`icon-btn relative w-auto gap-1.5 px-2.5 ${
        liked ? "text-danger hover:text-danger" : "hover:text-danger"
      }`}
    >
      {/* Expanding ring behind the heart. Absolutely positioned and
          pointer-events-none so it never eats the next click. */}
      {burstKey > 0 && liked && (
        <span
          key={burstKey}
          aria-hidden
          className="pointer-events-none absolute left-[13px] top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-ring-burst rounded-full bg-danger"
        />
      )}

      <Heart
        key={`${liked}`}
        className={`relative h-[18px] w-[18px] ${liked ? "animate-heart-pop fill-current" : ""}`}
        strokeWidth={2}
      />

      {displayCount > 0 && (
        <span className="relative text-subtle-semibold tabular-nums">
          {formatCount(displayCount)}
        </span>
      )}
    </button>
  );
};

export default LikeThreadComp;
