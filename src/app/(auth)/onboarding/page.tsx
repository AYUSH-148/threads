import UserProfileForm from '@/components/UserProfileForm';
import { fetchUser } from '@/lib/actions/user.action';
import { currentUser } from '@clerk/nextjs'
import { redirect } from 'next/navigation';
import React from 'react'

const page = async () => {
  const user = await currentUser();
  if (!user) return null;
  const userInfo = await fetchUser(user.id);
  if (userInfo?.onboarded) redirect("/");
  console.log(userInfo)
  const userData = {
    id: user.id,
    objectId: userInfo?._id,
    username: userInfo ? userInfo?.username : user.username,
    name: userInfo ? userInfo?.name : user.firstName ?? "",
    bio: userInfo ? userInfo?.bio : "",
    image: userInfo ? userInfo?.image : user.imageUrl,
  };
  return (
    <main className='mx-auto flex max-w-3xl flex-col justify-start px-10 py-20'>
      <h1 className='head-text'>Onboarding</h1>
      <p className='mt-3 text-base-regular text-light-2'>
        Complete your profile now, to use Threads.
      </p>

      <section className='mt-9 bg-dark-2 p-10'>
        <UserProfileForm userData={userData}/>
      </section>
    </main>
  )
}

export default page
