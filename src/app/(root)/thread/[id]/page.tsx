import { currentUser } from "@clerk/nextjs";
import { notFound, redirect } from "next/navigation";

import Comment from "@/components/Comment";
import ThreadCard from "@/components/ThreadCard";
import { fetchThreadById } from "@/lib/actions/thread.action";
import { fetchUser } from "@/lib/actions/user.action";

export const metadata = { title: "Thread" };

const Page = async ({ params }: { params: { id: string } }) => {
  if (!params.id) return null;

  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const thread = await fetchThreadById(params.id);
  // A deleted or mistyped id used to render a card of `undefined`s rather than
  // a 404.
  if (!thread) notFound();

  const replies = thread.children ?? [];

  return (
    <section className="animate-fade-up">
      <ThreadCard
        id={String(thread._id)}
        currentUser={user.id}
        parentId={thread.parentId}
        content={thread.text}
        author={thread.author}
        community={thread.community}
        createdAt={thread.createdAt}
        tags={thread.tags}
        likesCount={thread.likesCount ?? 0}
        likedByMe={thread.likedByMe ?? false}
        commentsCount={thread.commentsCount ?? 0}
        commentImages={thread.commentImages}
      />

      <Comment
        threadId={params.id}
        currentUserImg={user.imageUrl}
        currentUserId={String(userInfo._id)}
      />

      <div className="mt-8">
        <h2 className="section-label mb-2 px-1">
          {replies.length > 0
            ? `${replies.length} ${replies.length === 1 ? "Reply" : "Replies"}`
            : "Replies"}
        </h2>

        {replies.length === 0 ? (
          <p className="px-1 py-6 text-small-regular text-fg-subtle">
            No replies yet — yours would be the first.
          </p>
        ) : (
          <div className="stagger surface-card divide-y divide-hairline px-2">
            {replies.map((childItem: any) => (
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
        )}
      </div>
    </section>
  );
};

export default Page;
