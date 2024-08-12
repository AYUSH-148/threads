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
                    id={thread?._id}
                    currentUser={user.id}
                    currUserId2={userInfo._id}
                    parentId={thread?.parentId}
                    content={thread?.text}
                    author={thread?.author}
                    community={thread?.community}
                    createdAt={thread?.createdAt}
                    comments={thread?.children}
                    likes = {thread?.likes}
                />
            </div>
            <div className='mt-7'>
                <Comment
                    threadId={params.id}
                    currentUserImg={user.imageUrl}
                    currentUserId={JSON.stringify(userInfo._id)}
                />
            </div>
            <div className='mt-10'>
                {thread?.children.map((childItem: any) => (
                    <ThreadCard
                        key={childItem._id}
                        id={childItem._id}
                        currentUser={user.id}
                        parentId={childItem.parentId}
                        content={childItem.text}
                        author={childItem.author}
                        community={childItem.community}
                        createdAt={childItem.createdAt}
                        comments={childItem.children}
                        isComment
                        likes = {childItem.likes}
                    />
                ))}
            </div>
        </section>
    )
}

export default page
