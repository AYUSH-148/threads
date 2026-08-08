import Pagination from "@/components/Pagination";
import ThreadCard from "@/components/ThreadCard";
import { fetchPosts } from "@/lib/actions/thread.action";
import { fetchUser } from "@/lib/actions/user.action";
import { currentUser } from "@clerk/nextjs";

import { redirect } from "next/navigation";



export default async function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {

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
              // post.id was undefined here: `id` is a Mongoose virtual and this
              // query does not return hydrated documents.
              <div key={String(post._id)}>
                <ThreadCard
                  id={String(post._id)}
                  currentUser={user.id}
                  parentId={post.parentId}
                  content={post.text}
                  author={post.author}
                  community={post.community}
                  createdAt={post.createdAt}
                  tags={post.tags}
                  likesCount={post.likesCount}
                  likedByMe={post.likedByMe}
                  commentsCount={post.commentsCount}
                  commentImages={post.commentImages}
                />

              </div>
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
