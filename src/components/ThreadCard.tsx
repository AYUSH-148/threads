
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
    //@ts-ignore
    const userIds = likes.map(like => like.userId) || [];
    console.log("id",userIds)
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
                                {istags  && <Popover>
                                    <PopoverTrigger>
                                        <div className='text-gray-500 py-0.5 text-[14px] cursor-pointer bg-black hover:text-gray-400  px-2 rounded-xl md:mr-4'>
                                            T@gs
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent>
                                        <ul className='flex flex-col items-start gap-3  w-full 2'>
                                            {tags?.map((tag) => {
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

                            {isComment && comments && comments?.length > 0 && (
                                <Link href={`/thread/${id}`}>
                                    <p className='mt-1 text-subtle-medium text-gray-1'>
                                        {comments?.length} repl{comments?.length > 1 ? "ies" : "y"}
                                    </p>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
                <DeleteThread
                    threadId={JSON.stringify(id)}
                    currentUserId={currentUser}
                    authorId={author.id}
                    parentId={parentId}
                    isComment={isComment}
                />
            </div>
           
            <div className='flex items-center mt-2'>
            {!isComment && comments && comments.length > 0 && (
                <div className='ml-1 mt-1  flex items-center gap-2'>
                    {comments.slice(0, 2).map((comment, index) => (
                        <Image
                            key={index}
                            src={comment.author.image}
                            alt={`user_${index}`}
                            width={24}
                            height={24}
                            className={`${index !== 0 && "-ml-5"} rounded-full object-cover`}
                        />
                    ))}

                    <Link href={`/thread/${id}`}>
                        <p className='mt-1 text-subtle-medium text-gray-1'>
                            {comments.length} repl{comments.length > 1 ? "ies" : "y"}
                        </p>
                    </Link>
                </div>
            )} 
             {likes && likes.length > 0 && (
                <p className='ml-2 mt-2 text-[14px] text-gray-1 text-subtle-medium border-l border-gray-1 pl-2'>
                    {likes.length} like{likes.length > 1 ? "s" : ""}
                </p>
            )}
            </div>
           
            {tags && tags.length > 0 && (
                tags.map(() => {
                    return (null)
                })
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
