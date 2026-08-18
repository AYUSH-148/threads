"use client";

import { useOrganization } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import Select from "react-select";
import { z } from "zod";

import { Spinner } from "./ui/spinner";
import { useToast } from "./ui/use-toast";
import { createThread } from "@/lib/actions/thread.action";
import { fetchFriends } from "@/lib/actions/user.action";
import { ThreadValidation } from "@/lib/validators/thread";

interface ThreadProps {
  userId: string;
}

const PREDEFINED_TAGS = [
  { value: "social", label: "Social" },
  { value: "product", label: "Product" },
  { value: "design", label: "Design" },
  { value: "tech", label: "Tech" },
  { value: "startup", label: "Startup" },
  { value: "ai", label: "AI" },
  { value: "career", label: "Career" },
  { value: "lifestyle", label: "Lifestyle" },
];

/** Keeps the counter from turning red before the field is actually invalid. */
const MAX_CHARS = 1000;

const PostThread = ({ userId }: ThreadProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [, setMembers] = useState<{ username: string; id: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      try {
        const usersList = await fetchFriends(userId);
        // The request can still be in flight when the composer unmounts;
        // setting state then warns and leaks.
        if (!cancelled) setMembers(usersList);
      } catch (error) {
        console.error("Could not load mentionable members:", error);
      }
    };

    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const form = useForm<z.infer<typeof ThreadValidation>>({
    resolver: zodResolver(ThreadValidation),
    defaultValues: {
      thread: "",
      accountId: userId,
      tags: [],
    },
  });

  const text = form.watch("thread") ?? "";
  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof ThreadValidation>) => {
    try {
      await createThread({
        text: values.thread,
        communityId: organization ? organization.id : null,
        path: pathname,
        tags: values.tags ? values.tags.map((tag: any) => tag.value) : [],
      });
      router.push("/");
    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        variant: "destructive",
        title: "Thread not posted",
        description: "Something went wrong. Your draft is still here.",
      });
    }
  };

  return (
    <form
      className="surface-card mt-8 flex flex-col gap-6 p-5 sm:p-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      {organization && (
        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-3 py-2">
          <Users className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.2} />
          <p className="text-small-regular text-fg-muted">
            Posting to <span className="font-semibold text-fg">{organization.name}</span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="thread-body" className="text-small-semibold text-fg">
            What are you passing along?
          </label>
          <span
            className={`text-subtle-medium tabular-nums ${
              text.length > MAX_CHARS ? "text-danger" : "text-fg-subtle"
            }`}
          >
            {text.length}/{MAX_CHARS}
          </span>
        </div>

        <textarea
          id="thread-body"
          rows={10}
          placeholder="Share a thought, a question, or something worth passing on…"
          disabled={isSubmitting}
          {...form.register("thread")}
          className="field-input resize-y text-base-regular leading-relaxed disabled:opacity-60"
        />

        {form.formState.errors.thread && (
          <p className="text-subtle-medium text-danger">
            {form.formState.errors.thread.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-small-semibold text-fg">Tags</label>
        <Controller
          control={form.control}
          name="tags"
          render={({ field }) => (
            <Select
              isMulti
              instanceId="thread-tags"
              options={PREDEFINED_TAGS}
              onChange={(selected) => field.onChange(selected)}
              value={field.value as any}
              placeholder="Add a few tags…"
              // Drives the `.react-select__*` rules in globals.css, which is
              // what makes this control follow the theme.
              classNamePrefix="react-select"
              unstyled={false}
            />
          )}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !text.trim()}
          className="btn-brand px-6 py-2.5"
        >
          {isSubmitting ? (
            <Spinner className="h-4 w-4" label="Posting" />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2.2} />
          )}
          {isSubmitting ? "Posting…" : "Post thread"}
        </button>
      </div>
    </form>
  );
};

export default PostThread;
