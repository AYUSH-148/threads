import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// created by chatgpt  
// :Ensures valid Image url is passed
export function isBase64Image(imageData: string) {
  const base64Regex = /^data:image\/(png|jpe?g|gif|webp);base64,/;
  return base64Regex.test(imageData);
}

export function formatDateString(dateString: string){
    const  options:Intl.DateTimeFormatOptions={
      year:"numeric",
      month:"short",
      day:"numeric",
    }  
    const date = new Date(dateString);
    const formatDate = date.toLocaleDateString(undefined,options)
    const time = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  
    return `${time} - ${formatDate}`;
}
//  console.log(formatDateString('2024-07-28T14:35:00Z'));
//  Output might be "2:35 PM - Jul 28, 2024" (depending on locale)



// created by chatgpt
export function formatThreadCount(count: number): string {
  if (count === 0) {
    return "No Threads";
  } else {
    const threadCount = count.toString().padStart(2, "0");
    const threadWord = count === 1 ? "Thread" : "Threads";
    return `${threadCount} ${threadWord}`;
  }
}
//  console.log(formatThreadCount(1));    "01 Thread"
//  console.log(formatThreadCount(12));   "12 Threads"


/**
 * Compact age for feed timestamps ("3h", "2d").
 *
 * The absolute date stays available as the element's title/tooltip — the card
 * needs the scannable form, but a reader checking exactly when something was
 * posted should not have to leave the page for it.
 */
export function formatRelativeTime(dateString: string): string {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((Date.now() - then) / 1000);

  // Clock skew between the server that stamped the row and the client reading
  // it can put a just-created post a few seconds in the future.
  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (days < 365) return weeks < 5 ? `${weeks}w` : `${Math.floor(days / 30)}mo`;

  return `${Math.floor(days / 365)}y`;
}

/** "1.2k" past a thousand; counts sit in tight pills next to their icons. */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const thousands = value / 1000;
    return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, "") : Math.floor(thousands)}k`;
  }
  const millions = value / 1_000_000;
  return `${millions < 10 ? millions.toFixed(1).replace(/\.0$/, "") : Math.floor(millions)}M`;
}
