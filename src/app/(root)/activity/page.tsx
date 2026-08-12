import Image from "next/image";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import Pagination from "@/components/Pagination";
import MarkAllReadButton from "@/components/MarkAllReadButton";
import { formatDateString } from "@/lib/utils";
import { fetchUser } from "@/lib/actions/user.action";
import { getCurrentUserId } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications/service";
import type {
  NotificationActor,
  NotificationRow,
} from "@/lib/notifications/types";

/**
 * Reads materialised notification rows rather than deriving the feed.
 *
 * The previous version called getActivity(), which loaded every thread the
 * viewer had ever authored and flattened every embedded like into memory on
 * each page view — and could not express read state or pagination at all.
 *
 * The first page is rendered from the shared query module; the client takes over
 * from there through the API service. Pagination is a full navigation, so it
 * comes back through here rather than fetching — which keeps the feed
 * server-rendered and linkable.
 */
async function Page({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const userId = await getCurrentUserId();
  if (!userId) return null;

  // `searchParams` is whatever is in the URL, so `?page=abc` reaches here as NaN
  // and `?page=-3` as a negative. Normalised here as well as in the query module,
  // because the pager below renders this number back to the user.
  const pageNumber = Math.max(1, Math.floor(Number(searchParams?.page) || 1));
  const { notifications, isNext } = await listNotifications(userId, { page: pageNumber });

  const hasUnread = notifications.some((notification) => notification.unread);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="head-text">Activity</h1>
        {hasUnread && <MarkAllReadButton />}
      </div>

      <section className="mt-10 flex flex-col gap-5">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))
        ) : (
          <p className="!text-base-regular text-light-3">No activity yet</p>
        )}
      </section>

      <Pagination path="activity" pageNumber={pageNumber} isNext={isNext} />
    </>
  );
}

function NotificationCard({ notification }: { notification: NotificationRow }) {
  const [lead, ...rest] = notification.actors;

  // A notification always has at least one actor, but the actor's User document
  // can have been deleted since — so render defensively rather than crashing the
  // whole page on one dangling reference.
  if (!lead) return null;

  return (
    <Link href={`/thread/${notification.threadId}`}>
      <div
        className={`activity-card flex items-center justify-between gap-3 ${
          notification.unread ? "border-l-2 border-primary-500 pl-3" : ""
        }`}
      >
        <article className="flex min-w-0 items-center gap-2">
          <ActorAvatars actors={notification.actors} />

          <p className="!text-small-regular min-w-0 text-light-1">
            <Link href={`/profile/${lead.id}`} className="mr-1 text-primary-500">
              {lead.name || lead.username}
            </Link>
            {rest.length > 0 && othersLabel(notification.actorCount)}{" "}
            {VERBS[notification.kind]}
            {notification.threadPreview && (
              <span className="ml-1 text-light-3">
                &ldquo;{truncate(notification.threadPreview, 48)}&rdquo;
              </span>
            )}
          </p>
        </article>

        <p className="shrink-0 text-[12px] text-light-3">
          {formatDateString(notification.lastActorAt)}
        </p>
      </div>
    </Link>
  );
}

/** Up to three overlapping avatars, most recent first. */
function ActorAvatars({ actors }: { actors: NotificationActor[] }) {
  return (
    <span className="flex shrink-0 items-center">
      {actors.map((actor, index) => (
        <Image
          key={`${actor.id}-${index}`}
          src={actor.image}
          alt=""
          width={20}
          height={20}
          className={`rounded-full object-cover ${index > 0 ? "-ml-2" : ""}`}
        />
      ))}
    </span>
  );
}

/** actorCount includes the lead actor, who is already named. */
function othersLabel(actorCount: number): string {
  const others = actorCount - 1;
  return others === 1 ? " and 1 other" : ` and ${others} others`;
}

const VERBS: Record<NotificationRow["kind"], string> = {
  like: "liked your thread",
  reply: "replied to your thread",
  community_post: "posted in your community",
};

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

export default Page;
