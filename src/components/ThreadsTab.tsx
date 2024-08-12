import { fetchUserPosts } from '@/lib/actions/user.action'
import { redirect } from 'next/navigation'
import React from 'react'
import ThreadCard from './ThreadCard'
import { fetchCommunityPosts } from '@/lib/actions/community.actions'

interface Result {
    name: string,
    image: string,
    id: string,
    threads: {
        _id: string,
        text: string,
        parentId: string | null,
        author: {
            name: string,
            image: string,
            id: string
        },
        community: {
            id: string,
            name: string,
            image: string
        } | null,
        createdAt: string,
        children: {
            author: {
                image: string
            }
        }[]
        likes: string[]
        tags: string[]
    }[]
}

interface ThreadsTabProps {
    currentUserId: string,
    accountId: string,
    accountType: string
    currUserId2:string
}
const ThreadsTab = async ({ currentUserId, accountId, accountType,currUserId2 }: ThreadsTabProps) => {

    let result: Result;
    if (accountType === "Community") {
        result = await fetchCommunityPosts(accountId);
   
    } else {
        result = await fetchUserPosts(accountId);
    }

    if (!result) {
        redirect("/")
    }

    return (
        <section className='mt-9 flex flex-col gap-10'>
        {result.threads.map((thread) => (
          <ThreadCard
            key={thread._id}
            id={thread._id}
            currUserId2={currUserId2}
            currentUser={currentUserId}
            parentId={thread.parentId}
            content={thread.text}
            author={
              accountType === "User"
                ? { name: result.name, image: result.image, id: result.id }
                : {
                    name: thread.author.name,
                    image: thread.author.image,
                    id: thread.author.id,
                  }
            }
            community={
              accountType === "Community"
                ? { name: result.name, id: result.id, image: result.image }
                : thread.community
            }
            createdAt={thread.createdAt}
            comments={thread.children}
            tags={thread.tags}
            likes={thread.likes}
          />
        ))}
      </section>
    )
}

export default ThreadsTab
