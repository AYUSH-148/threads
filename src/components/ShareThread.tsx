"use client"
import React from 'react'
import Image from 'next/image'

interface shareThreadProps {
    id:string
}
const ShareThread = ({id}:shareThreadProps) => {

    const share = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Check out this link!",
                    text: "I found this interesting:",
                    url: `thread/${id}`, 
                });
                console.log("Successfully shared");
            } catch (error) {
                console.error("Error sharing:", error);
            }
        } else {
            alert("Web Share API is not supported in your browser.");
        }
    };
    return (
        <Image
            src='/assets/share.svg'
            alt='heart'
            width={24}
            height={24}
            className='cursor-pointer object-contain'
            onClick={share}
        />
    )
}

export default ShareThread
