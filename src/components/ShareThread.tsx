"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { useToast } from "./ui/use-toast";

interface ShareThreadProps {
  id: string;
}

const ShareThread = ({ id }: ShareThreadProps) => {
  const { toast } = useToast();
  const [justCopied, setJustCopied] = useState(false);

  const share = async () => {
    // The original passed the relative string `thread/${id}`, which the Web
    // Share API resolves against the *current* page — sharing from /activity
    // produced /activity/thread/<id>. Built from the origin instead.
    const url = `${window.location.origin}/thread/${id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "A thread on Relay", url });
        return;
      } catch (error) {
        // Dismissing the OS share sheet rejects with AbortError. That is the
        // user declining, not a failure, so it must not fall through to the
        // clipboard path and claim it copied something.
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    // Desktop browsers mostly have no share sheet; copying the link is the
    // equivalent action rather than the alert() the original showed.
    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "The thread link is on your clipboard.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Could not share",
        description: url,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label="Share this thread"
      className={`icon-btn ${justCopied ? "text-success" : "hover:text-aqua"}`}
    >
      {justCopied ? (
        <Check className="h-[18px] w-[18px] animate-scale-in" strokeWidth={2.4} />
      ) : (
        <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
      )}
    </button>
  );
};

export default ShareThread;
