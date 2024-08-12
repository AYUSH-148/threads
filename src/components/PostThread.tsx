"use client"
import { createThread } from "@/lib/actions/thread.action";
import { ThreadValidation } from "@/lib/validators/thread";
import { useOrganization } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import Select from 'react-select';
import { useEffect, useState } from "react";
import { fetchFriends } from "@/lib/actions/user.action";


interface ThreadProps {
  userId: string;
}

const PostThread = ({ userId }: ThreadProps) => {
  const router = useRouter();
  const pathname = usePathname();

  const { organization } = useOrganization();

  const [members, setMembers] = useState([{
    username:"",id:""
  }]);

  useEffect(() => {
    const fetchMembers = async () => {
      const usersList = await fetchFriends(userId);
      setMembers(usersList);
    }
    fetchMembers()
  }, [userId])

  const form = useForm<z.infer<typeof ThreadValidation>>({
    resolver: zodResolver(ThreadValidation),
    defaultValues: {
      thread: "",
      accountId: userId,
      tags: [] // Add default value for the multi-select
    }
  });

  const onSubmit = async (values: z.infer<typeof ThreadValidation>) => {
    await createThread({
      text: values.thread,
      author: userId,
      communityId: organization ? organization.id : null,
      path: pathname,
      tags: [""]
      // tags: values.tags ? values.tags.map((tag) => tag.value) : null
    });
    router.push("/");
  };

  const categories = members.map(member => ({
    value: `${member.id}-${member.username}`,
    label: member.username
  }));
  return (
    <>

     
      <Form {...form}>

        <form
          className='mt-10 flex flex-col justify-start gap-10'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name='tags'
            render={({ field }) => (
              <FormItem className='flex w-full flex-col gap-3'>
                <FormLabel className='text-base-semibold text-light-2'>
                  Tag
                </FormLabel>
                <FormControl className='no-focus border border-dark-4'>
                  <Select
                    isMulti
                    options={categories}
                    onChange={(selectedOptions) => field.onChange(selectedOptions)}
                    value={field.value}

                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='thread'
            render={({ field }) => (
              <FormItem className='flex w-full flex-col gap-3'>
                <FormLabel className=' text-light-2'>
                  Content
                </FormLabel>
                <FormControl className='no-focus border border-dark-4 bg-dark-3 text-light-1'>
                  <Textarea rows={15} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />


          <Button type='submit' className='bg-primary-500'>
            Post Thread
          </Button>
        </form>
      </Form>
    </>

  );
}

export default PostThread;
