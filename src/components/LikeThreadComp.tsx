"use client"
import React, { useState, useTransition } from 'react'
import { handleLikeToThread } from '@/lib/actions/thread.action'
import { usePathname } from 'next/navigation'
import { FaHeart, FaRegHeart } from "react-icons/fa";

interface LikeProps {
  threadId: string,
  userId: string,
  likes: string[]
}

const LikeThreadComp = ({ threadId, userId, likes }: LikeProps) => {

  const path = usePathname();
  const [, startTransition] = useTransition();

  // The server is the single source of truth for "have I liked this".
  const likedOnServer = Boolean(userId) && likes.includes(userId);

  // An optimistic override, held only while the action is in flight so the heart
  // reacts instantly. It is dropped the moment the server reports a different
  // value, so the two can never drift apart.
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [lastServerLiked, setLastServerLiked] = useState(likedOnServer);

  if (lastServerLiked !== likedOnServer) {
    setLastServerLiked(likedOnServer);
    setOptimisticLiked(null);
  }

  const liked = optimisticLiked ?? likedOnServer;

  const handleLike = () => {
    if (!userId) return;
    setOptimisticLiked(!liked);

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

  const Icon = liked ? FaHeart : FaRegHeart;

  return (
    <Icon
      onClick={handleLike}
      className={`cursor-pointer object-contain mt-1 text-[16px] ${liked ? "text-red-600" : "text-gray-600"
        }`}
    />
  )
}

export default LikeThreadComp;
