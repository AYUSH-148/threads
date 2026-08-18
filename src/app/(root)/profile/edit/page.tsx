import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import AccountProfile from "@/components/AccountProfile";
import PageHeader from "@/components/PageHeader";
import { fetchUser } from "@/lib/actions/user.action";

export const metadata = { title: "Edit profile" };

async function Page() {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const userData = {
    id: user.id,
    objectId: userInfo?._id,
    username: userInfo ? userInfo?.username : user.username,
    name: userInfo ? userInfo?.name : user.firstName ?? "",
    bio: userInfo ? userInfo?.bio : "",
    image: userInfo ? userInfo?.image : user.imageUrl,
  };

  return (
    <>
      <PageHeader
        icon="edit"
        title="Edit profile"
        subtitle="How you appear across Relay"
      />

      <section className="surface-card p-5 sm:p-7">
        <AccountProfile user={userData} />
      </section>
    </>
  );
}

export default Page;
