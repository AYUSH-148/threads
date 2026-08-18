import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import CommunityCard from "@/components/CommunityCard";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import { fetchCommunities } from "@/lib/actions/community.actions";
import { fetchUser } from "@/lib/actions/user.action";

export const metadata = { title: "Communities" };

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
  const result = await fetchCommunities({
    searchString: searchParams.q,
    pageNumber,
    pageSize: 25,
  });

  return (
    <>
      <PageHeader
        icon="community"
        title="Communities"
        subtitle="Spaces built around a shared interest"
      />

      <Suspense fallback={<div className="h-[46px] rounded-pill bg-surface-2" />}>
        <SearchBar routeType="communities" placeholder="Search communities" />
      </Suspense>

      <section className="mt-8">
        {result.communities.length === 0 ? (
          <EmptyState
            icon="community"
            title={searchParams.q ? "No communities matched" : "No communities yet"}
            description={
              searchParams.q
                ? `Nothing came back for “${searchParams.q}”.`
                : "Create one from the organisation switcher in the top bar."
            }
          />
        ) : (
          <div className="stagger flex flex-wrap justify-center gap-4 sm:justify-start">
            {result.communities.map((community) => (
              <CommunityCard
                key={community.id}
                id={community.id}
                name={community.name}
                username={community.username}
                imgUrl={community.image}
                bio={community.bio}
                members={community.members}
              />
            ))}
          </div>
        )}
      </section>

      <Pagination
        path="communities"
        pageNumber={pageNumber}
        isNext={result.isNext}
      />
    </>
  );
}

export default Page;
