import Image from "next/image";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { formatDateString } from '@/lib/utils'
import { fetchUser, getActivity } from "@/lib/actions/user.action";

async function Page() {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const activity = await getActivity(userInfo._id);
  console.log(activity)
  const combinedActivity = [
    ...activity.replies.map((reply) => ({
      type: "reply",
      data: reply,
    })),
    ...activity.likedUsers.map((like) => ({
      type: "like",
      data: like,
    })),
  ];

  return (
    <>
      <h1 className="head-text">Activity</h1>

      <section className="mt-10 flex flex-col gap-5">
        {combinedActivity.length > 0 ? (
          <>
            {combinedActivity.map((activity, index) => (
              <Link
                key={index}
                href={activity.type === "reply" ? `/thread/${activity.data.id}` : `/thread/${activity.data.threadId}`}

              >
                <div className="flex items-center justify-between activity-card ">
                  <article className="flex items-center gap-2">
                    {activity.type === "reply" ? (
                      <Image
                        src={activity.data.author.image}
                        alt="user_logo"
                        width={20}
                        height={20}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <Image
                        src={activity.data.image}
                        alt="user_logo"
                        width={20}
                        height={20}
                        className="rounded-full object-cover"
                      />
                    )}
                    <p className="!text-small-regular text-light-1">
                      {activity.type === "reply" ? (
                        <>
                          <Link href={`/profile/${activity.data.author.id}`} className="mr-1 text-primary-500">
                            {activity.data.author.name}
                          </Link>{" "}
                          replied to your thread
                        </>
                      ) : (
                        <>
                          <Link href={`/profile/${activity.data.id}`} className="mr-1 text-primary-500">
                            {activity.data.username}
                          </Link>{" "}
                          liked your thread
                        </>
                      )}

                    </p>
                  </article>
                  {activity.type === "like" &&
                    <p className="text-white text-[12px]">
                      {formatDateString(activity.data.likedAt)}
                    </p>
                  }
                </div>

              </Link>

            ))}
          </>
        ) : (
          <p className="!text-base-regular text-light-3">No activity yet</p>
        )}
      </section>
    </>
  );
}

export default Page;
