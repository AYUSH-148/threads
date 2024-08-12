import { currentUser } from "@clerk/nextjs";

import { communityTabs } from "@/constants";
import { formatDateString } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchCommunityDetails } from "@/lib/actions/community.actions";
import ProfileHeader from "@/components/ProfileHeader";
import UserCard from "@/components/UserCard";
import ThreadsTab from "@/components/ThreadsTab";

import Image from "next/image";
import { fetchUser } from "@/lib/actions/user.action";

async function Page({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return null;

  const communityDetails = await fetchCommunityDetails(params.id);
  const userInfo = await fetchUser(user.id)

  const bearerToken = process.env.CLERK_SECRET_KEY;

  const response = await fetch(`https://api.clerk.com/v1/organizations/${params.id}/invitations`, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Error fetching invites: ${response.statusText}`);
  }

  const invites = await response.json();
  console.log("Invitations -", invites);



  return (
    <section>
      <ProfileHeader
        accountId={communityDetails.createdBy.id}
        authUserId={user.id}
        name={communityDetails.name}
        username={communityDetails.username}
        imgUrl={communityDetails.image}
        bio={communityDetails.bio}
        type='Community'
      />

      <div className='mt-9'>
        <Tabs defaultValue='threads' className='w-full'>
          <TabsList className='tab'>
            {communityTabs.map((tab) => (
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
                    {communityDetails.threads.length}
                  </p>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value='threads' className='w-full text-light-1'>

            <ThreadsTab
              currentUserId={user.id}
              currUserId2={userInfo._id}
              accountId={communityDetails._id}
              accountType='Community'
            />
          </TabsContent>

          <TabsContent value='members' className='mt-9 w-full text-light-1'>
            <section className='mt-9 flex flex-col gap-10'>
              {communityDetails.members.map((member: any) => (
                <UserCard
                  key={member.id}
                  id={member.id}
                  name={member.name}
                  username={member.username}
                  imgUrl={member.image}
                  personType='User'
                />
              ))}
            </section>
          </TabsContent>

          <TabsContent value='requests' className='w-full text-light-1 flex flex-col gap-3 mt-4'>
            {invites && invites.data.length > 0 && invites.data.map((invite: any, index: any) => {
              return (
               
                  <article className='flex py-2.5 items-center gap-2 rounded-md bg-dark-2 px-7 justify-between' key={index}>
                    
                    <div className="flex items-center gap-2">
                    
                      Request sent to
                      <p className='!text-small-regular text-light-1'>
                        <span className='mr-1 text-primary-500'>
                          {invite.email_address}
                        </span>{" "}
                       
                      </p>
                     
                      <p className="text-[12.5px] text-gray-200">({formatDateString(invite.created_at)})</p>
                      {invite?.role.includes("admin") &&<p className="text-[12px] bg-green-600 rounded-full px-2 py-0.5">
                        Admin
                      </p>}
                    </div>

                   {invite.status==="accepted" && <p className="text-green-200">
                      Accepted
                  </p>}
                   {invite.status==="pending" && <p className="text-gray-300">
                      Pending.. 
                  </p>}
                   {invite.status==="revoked" && <p className="text-red-200">
                      Revoked
                  </p>}


                  </article>
               
              );
            })}
          </TabsContent>

        </Tabs>
      </div>
    </section>
  );
}

export default Page;
