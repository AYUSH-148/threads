
import Link from 'next/link'
import React from 'react'
import Image from 'next/image'
import DeleteThread from './DeleteThread'
import { formatDateString } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import LikeThreadComp from './LikeThreadComp'
import ShareThread from './ShareThread'
interface ThreadCardProps {
    id: string,
    currentUser: string,
    currUserId2: string,
    parentId: string | null,
    content: string,
    author: {
        name: string, image: string, id: string
    },
    community: {
        name: string, id: string, image: string
    } | null
    createdAt: string,
    comments?: {
        author: {
            image: string
        }
    }[],
    isComment?: boolean
    istags?: boolean
    tags?: string[]
    likes: string[]
}
const ThreadCard = ({
    id, author, currUserId2, currentUser, comments, community, isComment, createdAt, content, parentId, istags, tags, likes
}: ThreadCardProps) => {
    const safeAuthor = author ?? { name: "Unknown", image: "/assets/user.svg", id: "" };
    const safeCommunity = community ?? null;
    const safeComments = comments ?? [];
    const safeTags = tags ?? [];
    const safeLikes = Array.isArray(likes) ? likes : [];
    const userIds = safeLikes.map((like: any) => like?.userId ?? like).filter(Boolean);

    return (
        <article className={`flex w-full flex-col rounded-xl ${isComment ? "px-0 xs:px-7" : "bg-dark-2 p-7"}`}>
            <div className='flex items-start justify-between'>
                <div className='flex w-full flex-1 flex-row gap-4'>
                    <div className='flex flex-col items-center'>
                        <Link href={`/profile/${safeAuthor.id}`} className='relative h-11 w-11'>
                            <Image
                                src={safeAuthor.image || "/assets/user.svg"}
                                alt="user_community_image"
                                fill
                                className="cursor-pointer rounded-full"
                            />
                        </Link>
                        <div className='thread-card_bar' />
                    </div>
                    <div className='flex w-full flex-col'>
                        <Link href={`/profile/${safeAuthor.id}`} className='w-fit'>
                            <h4 className='cursor-pointer text-base-semibold text-light-1'>
                                {safeAuthor.name}
                            </h4>
                        </Link>
                        <p className='my-2 text-small-regular text-light-2 content-text'>{content || "No content"} </p>
                        <div className={`${isComment && "mb-10"} mt-2 flex flex-col gap-3`}>
                            <div className='flex justify-between items-center'>
                                <div className='flex gap-3.5'>

                                    <LikeThreadComp threadId={id} userId={currUserId2} likes={userIds}/>

                                    <Link href={`/thread/${id}`}>
                                        <Image
                                            src='/assets/reply.svg'
                                            alt='heart'
                                            width={24}
                                            height={24}
                                            className='cursor-pointer object-contain'
                                        />
                                    </Link>

                                    <ShareThread id={id}/>
                                   
                                </div>
                                {safeTags.length > 0 && <Popover>
                                    <PopoverTrigger>
                                        <div className='text-gray-500 py-0.5 text-[14px] cursor-pointer bg-black hover:text-gray-400  px-2 rounded-xl md:mr-4'>
                                            T@gs
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent>
                                        <ul className='flex flex-col items-start gap-3  w-full 2'>
                                            {safeTags.map((tag) => {
                                                return (
                                                    <Link href={`/profile/${tag.split("-")[0]}`} key={tag} className='truncate whitespace-nowrap w-full  cursor-pointer'>
                                                        <li className='px-1 text-[14px] text-gray-300'>@ {tag.split("-")[1]}</li>
                                                    </Link>
                                                )
                                            })}
                                        </ul>


                                    </PopoverContent>
                                </Popover>}


                            </div>

                            {isComment && safeComments.length > 0 && (
                                <Link href={`/thread/${id}`}>
                                    <p className='mt-1 text-subtle-medium text-gray-1'>
                                        {safeComments.length} repl{safeComments.length > 1 ? "ies" : "y"}
                                    </p>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
                <DeleteThread
                    threadId={JSON.stringify(id)}
                    currentUserId={currentUser}
                    authorId={safeAuthor.id}
                    parentId={parentId}
                    isComment={isComment}
                />
            </div>
           
            <div className='flex items-center mt-2'>
            {!isComment && safeComments.length > 0 && (
                <div className='ml-1 mt-1  flex items-center gap-2'>
                    {safeComments.slice(0, 2).map((comment: any, index: number) => (
                        <Image
                            key={index}
                            src={comment?.author?.image || "/assets/user.svg"}
                            alt={`user_${index}`}
                            width={24}
                            height={24}
                            className={`${index !== 0 && "-ml-5"} rounded-full object-cover`}
                        />
                    ))}

                    <Link href={`/thread/${id}`}>
                        <p className='mt-1 text-subtle-medium text-gray-1'>
                            {safeComments.length} repl{safeComments.length > 1 ? "ies" : "y"}
                        </p>
                    </Link>
                </div>
            )} 
             {safeLikes.length > 0 && (
                <p className='ml-2 mt-2 text-[14px] text-gray-1 text-subtle-medium border-l border-gray-1 pl-2'>
                    {safeLikes.length} like{safeLikes.length > 1 ? "s" : ""}
                </p>
            )}
            </div>
           
            {tags && tags.length > 0 && (
                tags.map(() => {
                    return (null)
                })
            )}
            {!isComment && safeCommunity && (
                <Link
                    href={`/communities/${safeCommunity.id}`}
                    className='mt-5 flex items-center'
                >
                    <p className='text-subtle-medium text-gray-1'>
                        {formatDateString(createdAt)}
                        {safeCommunity && ` - ${safeCommunity.name} Community`}
                    </p>

                    <Image
                        src={safeCommunity.image}
                        alt={safeCommunity.name}
                        width={14}
                        height={14}
                        className='ml-1 rounded-full object-cover'
                    />
                </Link>
            )}
        </article>
    )
}


export default ThreadCard
