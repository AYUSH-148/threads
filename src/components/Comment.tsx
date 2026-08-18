"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SendHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Avatar from "./ui/Avatar";
import { Spinner } from "./ui/spinner";
import { useToast } from "./ui/use-toast";
import { addCommentToThread } from "@/lib/actions/thread.action";
import { CommentValidation } from "@/lib/validators/thread";

interface CommentProps {
  threadId: string;
  currentUserImg: string;
  currentUserId: string;
}

const Comment = ({ threadId, currentUserImg }: CommentProps) => {
  const pathname = usePathname();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof CommentValidation>>({
    resolver: zodResolver(CommentValidation),
    defaultValues: { thread: "" },
  });

  const value = form.watch("thread");
  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof CommentValidation>) => {
    try {
      await addCommentToThread(threadId, values.thread, pathname);
      form.reset();
    } catch (error) {
      console.error("Error posting reply:", error);
      // The form previously reset unconditionally, so a failed reply silently
      // vanished along with whatever the user had typed.
      toast({
        variant: "destructive",
        title: "Reply not posted",
        description: "Your text is still here — try sending it again.",
      });
    }
  };

  return (
    <form className="comment-form" onSubmit={form.handleSubmit(onSubmit)}>
      <Avatar src={currentUserImg} alt="You" size="lg" ring />

      <div className="flex w-full min-w-0 flex-col gap-1">
        <input
          type="text"
          placeholder="Add your reply…"
          aria-label="Reply"
          disabled={isSubmitting}
          {...form.register("thread")}
          className="w-full border-none bg-transparent text-base-regular text-fg outline-none placeholder:text-fg-subtle disabled:opacity-60"
        />
        {form.formState.errors.thread && (
          <p className="text-subtle-medium text-danger">
            {form.formState.errors.thread.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !value?.trim()}
        className="comment-form_btn shrink-0"
      >
        {isSubmitting ? (
          <Spinner className="h-4 w-4" label="Posting reply" />
        ) : (
          <SendHorizontal className="h-4 w-4" strokeWidth={2.2} />
        )}
        Reply
      </button>
    </form>
  );
};

export default Comment;
