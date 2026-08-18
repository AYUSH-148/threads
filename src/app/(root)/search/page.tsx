import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";
import { Suspense } from "react";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import UserCard from "@/components/UserCard";
import { fetchUser, fetchUsers } from "@/lib/actions/user.action";

export const metadata = { title: "Discover" };

async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const pageNumber = Math.max(1, Math.floor(Number(searchParams?.page) || 1));
  const result = await fetchUsers({
    userId: user.id,
    searchString: searchParams.q,
    pageNumber,
    pageSize: 25,
  });

  return (
    <section>
      <PageHeader
        icon="search"
        title="Discover"
        subtitle="Find people worth following"
      />

      {/* SearchBar reads the ?q= param, and useSearchParams opts its subtree
          into client rendering — the boundary keeps that contained. */}
      <Suspense fallback={<div className="h-[46px] rounded-pill bg-surface-2" />}>
        <SearchBar routeType="search" placeholder="Search creators" />
      </Suspense>

      <div className="mt-8">
        {result.users.length === 0 ? (
          <EmptyState
            icon="user"
            title={searchParams.q ? "No one matched that" : "No people yet"}
            description={
              searchParams.q
                ? `Nothing came back for “${searchParams.q}”. Try a different name or username.`
                : "As people join Relay they will show up here."
            }
          />
        ) : (
          <div className="stagger surface-card flex flex-col gap-1 p-3">
            {result.users.map((person) => (
              <UserCard
                key={person.id}
                id={person.id}
                name={person.name}
                username={person.username}
                imgUrl={person.image}
                personType="User"
              />
            ))}
          </div>
        )}
      </div>

      <Pagination path="search" pageNumber={pageNumber} isNext={result.isNext} />
    </section>
  );
}

export default Page;
