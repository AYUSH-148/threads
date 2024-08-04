import PostThread from '@/components/PostThread';
import { fetchUser } from '@/lib/actions/user.action';
import { currentUser } from '@clerk/nextjs'
import { redirect } from 'next/navigation';
import React from 'react'

const page = async() => {
    const user = await currentUser();
    if(!user) return null;

    const userInfo = await fetchUser(user.id)
    if(!userInfo.onboarded) redirect('/onboarding')
  return (
   <>
     <h1 className='head-text'>Create Thread</h1>
     <PostThread userId={user.id} />
   </>
  )
}

export default page
