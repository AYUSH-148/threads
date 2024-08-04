import Image from "next/image";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import ThreadsTab from "@/components/ThreadsTab";
import { profileTabs } from "@/constants";
import { fetchUser, getActivity } from "@/lib/actions/user.action";
import ProfileHeader from "@/components/ProfileHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

async function Page({ params }: { params: { id: string } }) {
    const user = await currentUser();
    if (!user) return null;

    const userInfo = await fetchUser(params.id);
    if (!userInfo?.onboarded) redirect("/onboarding");

    const activity = await getActivity(userInfo._id);
    return (
        <section>
            <ProfileHeader
                accountId={userInfo.id}
                authUserId={user.id}
                name={userInfo.name}
                username={userInfo.username}
                imgUrl={userInfo.image}
                bio={userInfo.bio}
            />
            <div className='mt-9'>
                <Tabs defaultValue='threads' className='w-full'>
                    <TabsList className='tab'>
                        {profileTabs.map((tab) => (
                            <TabsTrigger key={tab.label} value={tab.value} className='tab'>
                                <Image
                                    src={tab.icon}
                                    alt={tab.label}
                                    width={24}
                                    height={24}
                                    className='object-contain'
                                />
                                <p className='max-sm:hidden'>{tab.label}</p>

                                {tab.label === "Threads" && (
                                    <p className='ml-1 rounded-sm bg-light-4 px-2 py-1 !text-tiny-medium text-light-2'>
                                        {userInfo.threads.length}
                                    </p>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {profileTabs.map((tab) => (
                        <TabsContent
                            key={`content-${tab.label}`}
                            value={tab.value}
                            className='w-full text-light-1'
                        >
                            {tab.value === "threads" && (
                                <ThreadsTab
                                    currentUserId={user.id}
                                    accountId={userInfo.id}
                                    accountType='User'
                                />
                            )}
                            {tab.value === "replies" && (
                                <section className="flex flex-col gap-3 mt-4 ">
                                    {activity.length > 0 ? (
                                        activity.map((activity) => (
                                            <Link key={activity._id} href={`/thread/${activity.parentId}`}>
                                                <article className='flex items-center gap-2 bg-dark-2 rounded-md px-7 py-3'>
                                                    <Image
                                                        src={activity.author.image}
                                                        alt='user_logo'
                                                        width={36}
                                                        height={36}
                                                        className='rounded-full'
                                                    />
                                                    <p className='!text-small-regular text-light-1'>
                                                        <span className='mr-1 text-primary-500'>
                                                            {activity.author.name}
                                                        </span>{" "}
                                                        replied to your thread
                                                    </p>
                                                </article>
                                            </Link>
                                        ))
                                    ) : (
                                        <p className='!text-base-regular text-light-3 mt-10 mx-auto'>No activity yet</p>
                                    )}
                                </section>
                            )}
                        </TabsContent>
                    ))}

                </Tabs>
            </div>
        </section>
    )
}

export default Page