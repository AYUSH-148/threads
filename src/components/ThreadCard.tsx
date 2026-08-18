import Link from "next/link";
import { MessageCircle } from "lucide-react";

import Avatar from "./ui/Avatar";
import DeleteThread from "./DeleteThread";
import LikeThreadComp from "./LikeThreadComp";
import ShareThread from "./ShareThread";
import { formatDateString, formatRelativeTime } from "@/lib/utils";

interface ThreadCardProps {
  id: string;
  currentUser: string;
  parentId: string | null;
  content: string;
  author: {
    name: string;
    image: string;
    id: string;
  };
  community: {
    name: string;
    id: string;
    image: string;
  } | null;
  createdAt: string;
  // Derived server-side. The card only ever needed these four values, so the
  // likes and children arrays they come from never reach the client.
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  /** Up to two commenter avatars; may be shorter than commentsCount. */
  commentImages?: string[];
  isComment?: boolean;
  tags?: string[];
}

const ThreadCard = ({
  id,
  author,
  currentUser,
  community,
  isComment,
  createdAt,
  content,
  parentId,
  tags,
  likesCount,
  likedByMe,
  commentsCount,
  commentImages = [],
}: ThreadCardProps) => {
  return (
    <article
      className={
        isComment
          ? "group relative rounded-2xl px-1 py-4 transition-colors duration-250 sm:px-4"
          : "group interactive-card gradient-ring p-5 sm:p-6"
      }
    >
      <div className="flex gap-3.5">
        {/* Avatar plus the connector line down to the replies. */}
        <div className="flex flex-col items-center">
          <Link
            href={`/profile/${author.id}`}
            className="transition-transform duration-300 ease-spring hover:scale-105"
          >
            <Avatar
              src={author.image}
              alt={author.name}
              size={isComment ? "sm" : "md"}
            />
          </Link>
          <div className="thread-card_bar" />
        </div>

        <div className="flex w-full min-w-0 flex-col">
          <header className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <Link href={`/profile/${author.id}`} className="min-w-0">
                <h4 className="truncate font-display text-base-semibold text-fg transition-colors duration-200 hover:text-brand">
                  {author.name}
                </h4>
              </Link>
              <time
                dateTime={createdAt}
                title={formatDateString(createdAt)}
                className="shrink-0 text-subtle-medium text-fg-subtle"
              >
                {formatRelativeTime(createdAt)}
              </time>
            </div>

            <DeleteThread
              threadId={id}
              currentUserId={currentUser}
              authorId={author.id}
              parentId={parentId}
              isComment={isComment}
            />
          </header>

          <p className="content-text mt-1.5 text-small-regular text-fg-muted">
            {content}
          </p>

          {tags && tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="chip-brand">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Action row. Each control is a pill with its own hover tint so the
              target is obvious — the originals were bare 24px icons with no
              affordance and no hit padding. */}
          <div className="mt-3.5 flex flex-wrap items-center gap-1">
            <LikeThreadComp
              threadId={id}
              likedByMe={likedByMe}
              likesCount={likesCount}
            />

            <Link
              href={`/thread/${id}`}
              className="icon-btn w-auto gap-1.5 px-2.5 hover:text-brand"
              aria-label={`Reply — ${commentsCount} ${
                commentsCount === 1 ? "reply" : "replies"
              }`}
            >
              <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
              {commentsCount > 0 && (
                <span className="text-subtle-semibold tabular-nums">
                  {commentsCount}
                </span>
              )}
            </Link>

            <ShareThread id={id} />

            {commentImages.length > 0 && (
              <Link
                href={`/thread/${id}`}
                className="ml-1 flex items-center gap-1.5 rounded-pill px-2 py-1 transition-colors duration-200 hover:bg-surface-2"
              >
                <span className="flex items-center">
                  {commentImages.map((image, index) => (
                    <span
                      key={index}
                      className={index !== 0 ? "-ml-2" : undefined}
                      style={{ zIndex: commentImages.length - index }}
                    >
                      <Avatar
                        src={image}
                        alt=""
                        size="xs"
                        className="ring-2 ring-surface"
                      />
                    </span>
                  ))}
                </span>
                <span className="text-subtle-medium text-fg-subtle">
                  {commentsCount} repl{commentsCount === 1 ? "y" : "ies"}
                </span>
              </Link>
            )}
          </div>

          {!isComment && community && (
            <Link
              href={`/communities/${community.id}`}
              className="mt-4 flex w-fit items-center gap-1.5 rounded-pill border border-hairline bg-surface-2 py-1 pl-1 pr-3 transition-all duration-250 hover:border-hairline-strong hover:bg-surface-3"
            >
              <Avatar src={community.image} alt={community.name} size="xs" />
              <span className="text-subtle-medium text-fg-subtle">
                {community.name}
              </span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
};

export default ThreadCard;
