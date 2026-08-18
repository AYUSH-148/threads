import type { IconName } from "@/components/ui/Icon";

export interface NavLink {
  /** Static href. `/profile` is completed with the viewer's id at render time. */
  route: string;
  label: string;
  /** Short label for the mobile bar, where the full one does not fit. */
  shortLabel: string;
  icon: IconName;
}

export const sidebarLinks: readonly NavLink[] = [
  { route: "/", label: "Home", shortLabel: "Home", icon: "home" },
  { route: "/search", label: "Discover", shortLabel: "Find", icon: "search" },
  { route: "/activity", label: "Activity", shortLabel: "Activity", icon: "heart" },
  { route: "/create-thread", label: "Compose", shortLabel: "Post", icon: "create" },
  { route: "/communities", label: "Communities", shortLabel: "Spaces", icon: "community" },
  { route: "/profile", label: "Profile", shortLabel: "You", icon: "user" },
] as const;

export interface TabLink {
  value: string;
  label: string;
  icon: IconName;
}

export const profileTabs: readonly TabLink[] = [
  { value: "threads", label: "Threads", icon: "reply" },
  { value: "replies", label: "Replies", icon: "comment" },
  { value: "tagged", label: "Tagged", icon: "tag" },
] as const;

export const communityTabs: readonly TabLink[] = [
  { value: "threads", label: "Threads", icon: "reply" },
  { value: "members", label: "Members", icon: "members" },
  { value: "requests", label: "Requests", icon: "request" },
] as const;
