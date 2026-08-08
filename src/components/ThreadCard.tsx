
import Link from 'next/link'
import React from 'react'
import Image from 'next/image'
import DeleteThread from './DeleteThread'
import { formatDateString } from '@/lib/utils'
import LikeThreadComp from './LikeThreadComp'
import ShareThread from './ShareThread'
interface ThreadCardProps {
    id: string,
    currentUser: string,
    parentId: string | null,
    content: string,
    author: {
        name: string, image: string, id: string
    },
    community: {
        name: string, id: string, image: string
    } | null
    createdAt: string,
    // Derived server-side. The card only ever needed these four values, so the
    // likes and children arrays they come from never reach the client.
    likesCount: number
    likedByMe: boolean
    commentsCount: number
    /** Up to two commenter avatars; may be shorter than commentsCount. */
    commentImages?: string[]
    isComment?: boolean
    tags?: string[]
}
const ThreadCard = ({
    id, author, currentUser, community, isComment, createdAt, content, parentId, tags,
    likesCount, likedByMe, commentsCount, commentImages = []
}: ThreadCardProps) => {
    return (
        <article className={`flex w-full flex-col rounded-xl ${isComment ? "px-0 xs:px-7" : "bg-dark-2 p-7"}`}>
            <div className='flex items-start justify-between'>
                <div className='flex w-full flex-1 flex-row gap-4'>
                    <div className='flex flex-col items-center'>
                        <Link href={`/profile/${author.id}`} className='relative h-11 w-11'>
                            <Image
                                src={author.image}
                                alt="user_community_image"
                                fill
                                className="cursor-pointer rounded-full"
                            />
                        </Link>
                        <div className='thread-card_bar' />
                    </div>
                    <div className='flex w-full flex-col'>
                        <Link href={`/profile/${author.id}`} className='w-fit'>
                            <h4 className='cursor-pointer text-base-semibold text-light-1'>
                                {author.name}
                            </h4>
                        </Link>
                        <p className='my-2 text-small-regular text-light-2 content-text'>{content} </p>
                        <div className={`${isComment && "mb-10"} mt-2 flex flex-col gap-3`}>
                            <div className='flex justify-between items-center'>
                                <div className='flex gap-3.5'>

                                    <LikeThreadComp threadId={id} likedByMe={likedByMe}/>

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
                            </div>

                            {isComment && commentsCount > 0 && (
                                <Link href={`/thread/${id}`}>
                                    <p className='mt-1 text-subtle-medium text-gray-1'>
                                        {commentsCount} repl{commentsCount > 1 ? "ies" : "y"}
                                    </p>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
                <DeleteThread
                    threadId={id}
                    currentUserId={currentUser}
                    authorId={author.id}
                    parentId={parentId}
                    isComment={isComment}
                />
            </div>
           
            <div className='flex items-center mt-2'>
            {!isComment && commentsCount > 0 && (
                <div className='ml-1 mt-1  flex items-center gap-2'>
                    {commentImages.map((image, index) => (
                        <Image
                            key={index}
                            src={image}
                            alt={`user_${index}`}
                            width={24}
                            height={24}
                            className={`${index !== 0 && "-ml-5"} rounded-full object-cover`}
                        />
                    ))}

                    <Link href={`/thread/${id}`}>
                        <p className='mt-1 text-subtle-medium text-gray-1'>
                            {commentsCount} repl{commentsCount > 1 ? "ies" : "y"}
                        </p>
                    </Link>
                </div>
            )}
             {likesCount > 0 && (
                <p className='ml-2 mt-2 text-[14px] text-gray-1 text-subtle-medium border-l border-gray-1 pl-2'>
                    {likesCount} like{likesCount > 1 ? "s" : ""}
                </p>
            )}
            </div>
           
            {tags && tags.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-2'>
                    {tags.map((tag) => (
                        <span key={tag} className='rounded-full bg-primary-500/20 px-2 py-1 text-[12px] text-primary-500'>#{tag}</span>
                    ))}
                </div>
            )}
            {!isComment && community && (
                <Link
                    href={`/communities/${community.id}`}
                    className='mt-5 flex items-center'
                >
                    <p className='text-subtle-medium text-gray-1'>
                        {formatDateString(createdAt)}
                        {community && ` - ${community.name} Community`}
                    </p>

                    <Image
                        src={community.image}
                        alt={community.name}
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
