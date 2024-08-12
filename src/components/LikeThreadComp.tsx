"use client"
import React, { useEffect, useState } from 'react'
import { handleLikeToThread } from '@/lib/actions/thread.action'
import { usePathname, useRouter } from 'next/navigation'
import { FaHeart, FaRegHeart } from "react-icons/fa";

interface LikeProps {
  threadId: string,
  userId:string,
  likes: string[]
}

const LikeThreadComp = ({ threadId,userId,likes }: LikeProps) => {
  
  const path = usePathname();
  const router = useRouter();
  const [showLike, setShowLike] = useState<boolean>(false);
  
  useEffect(() => {
    if (likes && likes.includes(userId)) {
      setShowLike(true);
    } else {
      setShowLike(false);
    }
  }, [likes, userId]);
  
  const handleLike = async () => {
    try {
      await handleLikeToThread(threadId, userId, path);
      router.refresh();
      setShowLike(prev => !prev); 
    } catch (error) {
      console.error("Error handling like:", error);
    }
  };
  

  return (
    <>
     
        {showLike ? (
          <FaHeart
            className="cursor-pointer object-contain mt-1  text-red-600 text-[16px]"
            onClick={handleLike}
          />

        ) : (
          <FaRegHeart
            className="cursor-pointer object-contain mt-1  text-gray-600 text-[16px]"
            onClick={handleLike}
          />
        )}


    </>
  )
}

export default LikeThreadComp;
