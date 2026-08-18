import { currentUser } from "@clerk/nextjs";
import { notFound } from "next/navigation";

import Icon from "@/components/ui/Icon";
import ProfileHeader from "@/components/ProfileHeader";
import ThreadsTab from "@/components/ThreadsTab";
import UserCard from "@/components/UserCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { communityTabs } from "@/constants";
import { fetchCommunityDetails } from "@/lib/actions/community.actions";
import { formatDateString } from "@/lib/utils";

const INVITE_STATUS_STYLES: Record<string, string> = {
  accepted: "border-success/30 bg-success/10 text-success",
  pending: "border-hairline bg-surface-2 text-fg-subtle",
  revoked: "border-danger/30 bg-danger/10 text-danger",
};

async function Page({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return null;

  const communityDetails = await fetchCommunityDetails(params.id);
  // An unknown community id used to fall through to a crash on the first
  // property access below.
  if (!communityDetails) notFound();

  let invites: any[] = [];
  const bearerToken = process.env.CLERK_SECRET_KEY;

  if (bearerToken && params.id) {
    try {
      const response = await fetch(
        `https://api.clerk.com/v1/organizations/${params.id}/invitations`,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        invites = Array.isArray(data?.data) ? data.data : [];
      } else if (response.status !== 404) {
        console.error(
          "Error fetching invites:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error fetching invites:", error);
    }
  }

  const counts: Record<string, number> = {
    threads: communityDetails.threads.length,
    members: communityDetails.members.length,
    requests: invites.length,
  };

  return (
    <section className="animate-fade-up">
      <ProfileHeader
        accountId={communityDetails.createdBy.id}
        authUserId={user.id}
        name={communityDetails.name}
        username={communityDetails.username}
        imgUrl={communityDetails.image}
        bio={communityDetails.bio}
        type="Community"
      />

      <div className="mt-6">
        <Tabs defaultValue="threads" className="w-full">
          <TabsList>
            {communityTabs.map((tab) => (
              <TabsTrigger key={tab.label} value={tab.value}>
                <Icon name={tab.icon} className="h-4 w-4" strokeWidth={2.1} />
                <span className="max-xs:hidden">{tab.label}</span>
                <span className="count-pill">{counts[tab.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="threads">
            <ThreadsTab
              currentUserId={user.id}
              accountId={communityDetails._id}
              accountType="Community"
            />
          </TabsContent>

          <TabsContent value="members">
            {communityDetails.members.length > 0 ? (
              <div className="stagger surface-card flex flex-col gap-1 p-3">
                {communityDetails.members.map((member: any) => (
                  <UserCard
                    key={member.id}
                    id={member.id}
                    name={member.name}
                    username={member.username}
                    imgUrl={member.image}
                    personType="User"
                  />
                ))}
              </div>
            ) : (
              <p className="px-1 py-8 text-center text-small-regular text-fg-subtle">
                No members yet.
              </p>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {invites.length > 0 ? (
              <div className="stagger flex flex-col gap-2.5">
                {invites.map((invite: any, index: number) => (
                  <article
                    key={index}
                    className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-small-regular text-fg-subtle">
                        Invited
                      </span>
                      <span className="truncate text-small-semibold text-fg">
                        {invite.email_address || "Unknown recipient"}
                      </span>
                      {invite?.role?.includes("admin") && (
                        <span className="chip border-brand/25 bg-brand/10 text-brand">
                          Admin
                        </span>
                      )}
                      <span className="text-subtle-medium text-fg-subtle">
                        {formatDateString(
                          invite.created_at || new Date().toISOString()
                        )}
                      </span>
                    </div>

                    {invite.status && (
                      <span
                        className={`chip capitalize ${
                          INVITE_STATUS_STYLES[invite.status] ??
                          INVITE_STATUS_STYLES.pending
                        }`}
                      >
                        {invite.status}
                      </span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="px-1 py-8 text-center text-small-regular text-fg-subtle">
                No invite requests yet.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

export default Page;
