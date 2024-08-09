"use client"
import { fetchtaggedByUsers } from '@/lib/actions/thread.action';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import Image from "next/image"
import { formatDateString } from '@/lib/utils'
interface threadProps {
    tagStr: string
}

const TagsComp = ({ tagStr }: threadProps) => {
    const [threadInfo, setThreadInfo] = useState([{
        _id: null,
        createdAt: "",
        author: {
            _id: null, id: null, username: "", image: ""
        }
    }]);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                console.log("Fetching threads for tagStr:", tagStr);
                const usersList: any = await fetchtaggedByUsers(tagStr);
                setThreadInfo(usersList);

            } catch (err) {
                console.error("Failed to fetch members", err);
                setError("Failed to fetch members");
            }
        }
        fetchMembers();
    }, [tagStr]);

    return (
        <div>
            {error && <p>{error}</p>}
            {threadInfo && threadInfo.length > 0 ? (
                threadInfo.map((thread) => {
                    return (
                        <article className='activity-card' key={thread._id}>
                            <div className='flex items-center justify-between w-full'>
                                <Link href={`/profile/${thread.author.id}`} className='flex items-center gap-2'>
                                    <Image
                                        src={thread.author.image}
                                        alt='user_logo'
                                        width={20}
                                        height={20}
                                        className='rounded-full object-cover'
                                    />
                                    <p className='!text-small-regular text-light-1'>
                                        <span className='mr-1 text-primary-500'>
                                            {thread.author.username}
                                        </span>
                                        {" "}
                                        tagged you in a <Link href={`/thread/${thread._id}`} className='text-sky-200   px-1 hover:underline'>thread </Link>
                                    </p>
                                </Link>
                                <p className='text-[13px]'>{formatDateString(thread.createdAt)}</p>
                            </div>

                        </article>
                    )
                }

                )) : (
                <p>No threads found</p>
            )}
        </div>
    );
}

export default TagsComp;