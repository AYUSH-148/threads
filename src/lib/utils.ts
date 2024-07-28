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

