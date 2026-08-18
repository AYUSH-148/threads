import { currentUser } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import Avatar from "@/components/ui/Avatar";
import Icon from "@/components/ui/Icon";
import ProfileHeader from "@/components/ProfileHeader";
import TagsComp from "@/components/TagsComp";
import ThreadsTab from "@/components/ThreadsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { profileTabs } from "@/constants";
import { fetchUser, getReplies } from "@/lib/actions/user.action";

async function Page({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(params.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  // This tab renders replies only, so it no longer asks for the likes half.
  const replies = await getReplies(userInfo._id);

  const counts: Record<string, number> = {
    threads: userInfo.threads.length,
    replies: replies.length,
  };

  return (
    <section className="animate-fade-up">
      <ProfileHeader
        accountId={userInfo.id}
        authUserId={user.id}
        name={userInfo.name}
        username={userInfo.username}
        imgUrl={userInfo.image}
        bio={userInfo.bio}
      />

      <div className="mt-6">
        <Tabs defaultValue="threads" className="w-full">
          <TabsList>
            {profileTabs.map((tab) => (
              <TabsTrigger key={tab.label} value={tab.value}>
                <Icon name={tab.icon} className="h-4 w-4" strokeWidth={2.1} />
                <span className="max-xs:hidden">{tab.label}</span>
                {counts[tab.value] !== undefined && (
                  <span className="count-pill">{counts[tab.value]}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="threads">
            <ThreadsTab
              currentUserId={user.id}
              accountId={userInfo.id}
              accountType="User"
            />
          </TabsContent>

          <TabsContent value="replies">
            {replies.length > 0 ? (
              <div className="stagger flex flex-col gap-2.5">
                {replies.map((reply) => (
                  <Link key={reply.id} href={`/thread/${reply.parentId}`}>
                    <article className="activity-card">
                      <Avatar
                        src={reply.author.image}
                        alt={reply.author.name}
                        size="sm"
                      />
                      <p className="text-small-regular text-fg-muted">
                        <span className="font-semibold text-fg">
                          {reply.author.name}
                        </span>{" "}
                        replied to this thread
                      </p>
                    </article>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-1 py-8 text-center text-small-regular text-fg-subtle">
                No replies yet.
              </p>
            )}
          </TabsContent>

          <TabsContent value="tagged">
            <TagsComp tagStr={`${params.id}-${userInfo.username}`} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

export default Page;
