"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Avatar from "./ui/Avatar";
import EmptyState from "./EmptyState";
import { ActivityCardSkeleton } from "./ui/skeleton";
import { fetchtaggedByUsers } from "@/lib/actions/thread.action";
import { formatDateString, formatRelativeTime } from "@/lib/utils";

interface TaggedThread {
  _id: string | null;
  createdAt: string;
  author: {
    _id: string | null;
    id: string | null;
    username: string;
    image: string;
  };
}

interface ThreadProps {
  tagStr: string;
}

const TagsComp = ({ tagStr }: ThreadProps) => {
  const [threads, setThreads] = useState<TaggedThread[]>([]);
  // Started as true rather than false: the list is empty on first render
  // because the fetch has not run yet, and the old version showed
  // "No threads found" during that window.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const list: any = await fetchtaggedByUsers(tagStr);
        if (!cancelled) setThreads(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to fetch tagged threads", err);
        if (!cancelled) setError("Could not load tagged threads.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [tagStr]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        <ActivityCardSkeleton />
        <ActivityCardSkeleton />
        <ActivityCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-card border border-danger/25 bg-danger/5 px-5 py-4 text-small-regular text-danger">
        {error}
      </p>
    );
  }

  if (threads.length === 0) {
    return (
      <EmptyState
        icon="tag"
        title="No tagged threads"
        description="Threads that tag this account will collect here."
      />
    );
  }

  return (
    <div className="stagger flex flex-col gap-2.5">
      {threads.map((thread) => (
        <Link key={String(thread._id)} href={`/thread/${thread._id}`}>
          <article className="activity-card">
            <Avatar
              src={thread.author.image}
              alt={thread.author.username}
              size="sm"
            />

            <p className="min-w-0 flex-1 text-small-regular text-fg-muted">
              <span className="font-semibold text-fg">
                {thread.author.username}
              </span>{" "}
              tagged this account in a thread
            </p>

            <time
              dateTime={thread.createdAt}
              title={formatDateString(thread.createdAt)}
              className="shrink-0 text-subtle-medium text-fg-subtle"
            >
              {formatRelativeTime(thread.createdAt)}
            </time>
          </article>
        </Link>
      ))}
    </div>
  );
};

export default TagsComp;
