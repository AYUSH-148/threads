import Pagination from "@/components/Pagination";
import ThreadCard from "@/components/ThreadCard";
import { fetchPosts } from "@/lib/actions/thread.action";
import { fetchUser } from "@/lib/actions/user.action";
import { currentUser } from "@clerk/nextjs";

import { redirect } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";


export default async function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  console.log(useOrganization)
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const result = await fetchPosts(
    searchParams.page ? +searchParams.page : 1,
    30
  );
 
  return (
    <>
      <h1 className='head-text text-left'>Home</h1>

      <section className='mt-9 flex flex-col gap-10'>
        {result.posts.length === 0 ? (
          <p className='no-result'>No threads found</p>
        ) : (
          <>
            {result.posts.map((post) => (
              <ThreadCard
                key={post._id}
                id={post._id}
                currentUser={user.id}
                parentId={post.parentId}
                content={post.text}
                author={post.author}
                community={post.community}
                createdAt={post.createdAt}
                comments={post.children}
                istags= {post.tags.length>0}
                tags = {post.tags}
              />
            ))}
          </>
        )}
      </section>
      
      <Pagination
        path='/'
        pageNumber={searchParams?.page ? +searchParams.page : 1}
        isNext={result.isNext}
      />
    </>

  );
}
