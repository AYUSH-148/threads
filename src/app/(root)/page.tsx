import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import ThreadCard from "@/components/ThreadCard";
import { fetchPosts } from "@/lib/actions/thread.action";
import { fetchUser } from "@/lib/actions/user.action";

export default async function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const pageNumber = Math.max(1, Math.floor(Number(searchParams?.page) || 1));
  const result = await fetchPosts(pageNumber, 30);

  return (
    <>
      <PageHeader
        icon="home"
        title="Home"
        subtitle="The latest from everyone you can see"
      />

      {result.posts.length === 0 ? (
        <EmptyState
          icon="create"
          title="Nothing here yet"
          description="No threads have been posted. Be the first to start one."
          action={{ label: "Write a thread", href: "/create-thread" }}
        />
      ) : (
        <section className="stagger flex flex-col gap-4">
          {result.posts.map((post) => (
            // post.id was undefined here: `id` is a Mongoose virtual and this
            // query does not return hydrated documents.
            <ThreadCard
              key={String(post._id)}
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
          ))}
        </section>
      )}

      <Pagination path="/" pageNumber={pageNumber} isNext={result.isNext} />
    </>
  );
}
