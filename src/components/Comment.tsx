"use client"
import { addCommentToThread } from '@/lib/actions/thread.action';
import { CommentValidation } from '@/lib/validators/thread';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePathname } from 'next/navigation'
import React from 'react'
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from './ui/form';
import Image from 'next/image';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface CommentProps {
    threadId: string,
    currentUserImg: string,
    currentUserId: string
}
const Comment = ({ threadId, currentUserImg, currentUserId }: CommentProps) => {
    const pathname = usePathname();
    const form = useForm<z.infer<typeof CommentValidation>>({
        resolver: zodResolver(CommentValidation),
        defaultValues: {
            thread: "",
        }
    })
    const onSubmit = async (values: z.infer<typeof CommentValidation>) => {
        await addCommentToThread(
            threadId,
            values.thread,
            JSON.parse(currentUserId),
            pathname
        );

        form.reset();
    }
    return (
        <Form {...form}>
            <form className='comment-form' onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                    control={form.control}
                    name='thread'
                    render={({ field }) => (
                        <FormItem className='flex w-full items-center gap-3'>
                            <FormLabel>
                                <Image
                                    src={currentUserImg}
                                    alt='current_user'
                                    width={48}
                                    height={48}
                                    className='rounded-full object-cover'
                                />
                            </FormLabel>
                            <FormControl className='border-none bg-transparent'>
                                <Input
                                    type='text'
                                    {...field}
                                    placeholder='Comment...'
                                    className='no-focus text-light-1 outline-none'
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <Button type='submit' className='comment-form_btn'>
                    Reply
                </Button>
            </form>
        </Form>
    )
}

export default Comment
