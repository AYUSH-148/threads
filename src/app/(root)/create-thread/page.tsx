import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import PostThread from "@/components/PostThread";
import { fetchUser } from "@/lib/actions/user.action";

export const metadata = { title: "Compose" };

const Page = async () => {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  return (
    <>
      <PageHeader
        icon="create"
        title="Compose"
        subtitle="Start a thread and pass it along"
      />
      <PostThread userId={userInfo._id} />
    </>
  );
};

export default Page;
