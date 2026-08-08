import ThreadCard from '@/components/ThreadCard';
import { fetchThreadById } from '@/lib/actions/thread.action';
import { fetchUser } from '@/lib/actions/user.action';
import { currentUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import React from 'react'
import Comment from '@/components/Comment';
const page = async ({ params }: { params: { id: string } }) => {

    if (!params.id) return null;

    const user = await currentUser();
    if (!user) return null;

    const userInfo = await fetchUser(user.id);
    if (!userInfo?.onboarded) redirect("/onboarding");

    const thread = await fetchThreadById(params.id)

    return (
        <section className='relative'>
            <div>
                <ThreadCard
                    id={String(thread?._id)}
                    currentUser={user.id}
                    parentId={thread?.parentId}
                    content={thread?.text}
                    author={thread?.author}
                    community={thread?.community}
                    createdAt={thread?.createdAt}
                    likesCount={thread?.likesCount ?? 0}
                    likedByMe={thread?.likedByMe ?? false}
                    commentsCount={thread?.commentsCount ?? 0}
                    commentImages={thread?.commentImages}
                />
            </div>
            <div className='mt-7'>
                <Comment
                    threadId={params.id}
                    currentUserImg={user.imageUrl}
                    currentUserId={String(userInfo._id)}
                />
            </div>
            <div className='mt-10'>
                {thread?.children.map((childItem: any) => (
                    <ThreadCard
                        key={String(childItem._id)}
                        id={String(childItem._id)}
                        currentUser={user.id}
                        parentId={childItem.parentId}
                        content={childItem.text}
                        author={childItem.author}
                        community={childItem.community}
                        createdAt={childItem.createdAt}
                        isComment
                        likesCount={childItem.likesCount}
                        likedByMe={childItem.likedByMe}
                        commentsCount={childItem.commentsCount}
                        commentImages={childItem.commentImages}
                    />
                ))}
            </div>
        </section>
    )
}

export default page
