"use client";

import { Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { deleteThread } from "@/lib/actions/thread.action";
import { useToast } from "./ui/use-toast";

interface Props {
  threadId: string;
  currentUserId: string;
  authorId: string;
  parentId: string | null;
  isComment?: boolean;
}

function DeleteThread({
  threadId,
  currentUserId,
  authorId,
  parentId,
  isComment,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (currentUserId !== authorId || pathname === "/") return null;

  const remove = async () => {
    setIsDeleting(true);
    try {
      await deleteThread(threadId, pathname);
      if (!parentId || !isComment) router.push("/");
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast({
        variant: "destructive",
        title: "Could not delete",
        description: "The thread is still there. Try again in a moment.",
      });
      setIsDeleting(false);
      setConfirming(false);
    }
  };

  // A two-step confirm rather than a window.confirm(): deleting used to happen
  // on a single click of an 18px icon with no undo, which is a lot of finality
  // for one mis-tap.
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1 animate-scale-in">
        <button
          type="button"
          onClick={() => void remove()}
          disabled={isDeleting}
          className="rounded-pill bg-danger px-2.5 py-1 text-subtle-semibold text-white transition-opacity duration-200 disabled:opacity-60"
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Delete"
          )}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isDeleting}
          className="rounded-pill px-2 py-1 text-subtle-semibold text-fg-subtle transition-colors duration-200 hover:text-fg"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Delete this thread"
      // Hidden until the card is hovered on pointer devices so it does not
      // compete with the post itself; always visible on touch, which has no
      // hover state to reveal it.
      className="icon-btn h-8 w-8 shrink-0 opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

export default DeleteThread;
