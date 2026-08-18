import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import UserProfileForm from "@/components/UserProfileForm";
import { fetchUser } from "@/lib/actions/user.action";

export const metadata = { title: "Set up your profile · Relay" };

const Page = async () => {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (userInfo?.onboarded) redirect("/");

  const userData = {
    id: user.id,
    objectId: userInfo?._id,
    // Clerk's username is nullable; the form prop is not.
    username: userInfo ? userInfo.username : user.username ?? "",
    name: userInfo ? userInfo?.name : user.firstName ?? "",
    bio: userInfo ? userInfo?.bio : "",
    image: userInfo ? userInfo?.image : user.imageUrl,
  };

  return (
    <div className="w-full max-w-xl">
      <div className="mb-6 text-center">
        <h1 className="head-text">
          Set up your <span className="gradient-text">profile</span>
        </h1>
        <p className="mt-2 text-base-regular text-fg-muted">
          A name, a handle and a line about you. You can change all of it later.
        </p>
      </div>

      <section className="surface-card p-5 sm:p-8">
        <UserProfileForm userData={userData} />
      </section>
    </div>
  );
};

export default Page;
