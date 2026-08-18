import Link from "next/link";
import { currentUser } from "@clerk/nextjs";
import { Sparkles, Users } from "lucide-react";

import UserCard from "./UserCard";
import { fetchCommunities } from "@/lib/actions/community.actions";
import { fetchUsers } from "@/lib/actions/user.action";

async function RightSidebar() {
  const user = await currentUser();
  if (!user) return null;

  const similarMinds = await fetchUsers({
    userId: user.id,
    pageSize: 4,
  });

  const suggestedCommunities = await fetchCommunities({ pageSize: 4 });
  // This list renders names and avatars only, so skip the members join — this
  // component is in the layout and therefore runs on every page load.
  const suggestedCOmmunities = await fetchCommunities({
    pageSize: 4,
    includeMembers: false,
  });

  return (
    <section className="custom-scrollbar rightsidebar w-[332px]">
      <Panel
        icon={<Users className="h-4 w-4" strokeWidth={2.2} />}
        title="Communities"
        href="/communities"
        isEmpty={suggestedCommunities.communities.length === 0}
        emptyText="No communities yet"
      >
        {suggestedCommunities.communities.map((community) => (
          <UserCard
            key={community.id}
            id={community.id}
            name={community.name}
            username={community.username}
            imgUrl={community.image}
            personType="Community"
          />
        ))}
      </Panel>

      <Panel
        icon={<Sparkles className="h-4 w-4" strokeWidth={2.2} />}
        title="Similar minds"
        href="/search"
        isEmpty={similarMinds.users.length === 0}
        emptyText="No one to suggest yet"
      >
        {similarMinds.users.map((person) => (
          <UserCard
            key={person.id}
            id={person.id}
            name={person.name}
            username={person.username}
            imgUrl={person.image}
            personType="User"
          />
        ))}
      </Panel>
    </section>
  );
}

/** The two rails share a frame, so it lives in one place. */
function Panel({
  icon,
  title,
  href,
  isEmpty,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h3 className="flex items-center gap-2 font-display text-base-semibold text-fg">
          <span className="text-brand">{icon}</span>
          {title}
        </h3>
        <Link
          href={href}
          className="text-subtle-semibold text-fg-subtle transition-colors duration-200 hover:text-brand"
        >
          See all
        </Link>
      </div>

      {isEmpty ? (
        <p className="px-1 py-4 text-small-regular text-fg-subtle">{emptyText}</p>
      ) : (
        <div className="stagger flex flex-col gap-1">{children}</div>
      )}
    </div>
  );
}

export default RightSidebar;
