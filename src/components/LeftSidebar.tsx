"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SignOutButton, SignedIn, useAuth } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import Icon from "./ui/Icon";
import { sidebarLinks } from "@/constants";

/**
 * `/profile` needs the viewer's id appended, but `/` must not match every route
 * by prefix. Kept as a function rather than inlined so the bottom bar can share
 * exactly the same rule — the two used to disagree about which tab was lit.
 */
export function resolveRoute(route: string, userId: string | null | undefined) {
  return route === "/profile" && userId ? `/profile/${userId}` : route;
}

export function isRouteActive(route: string, pathname: string) {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

const LeftSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { userId } = useAuth();

  return (
    <section className="custom-scrollbar leftsidebar w-[86px] lg:w-[248px]">
      <div className="flex w-full flex-1 flex-col gap-1.5 px-3 lg:px-4">
        <p className="section-label mb-2 px-3 max-lg:hidden">Navigate</p>

        {sidebarLinks.map((link) => {
          // The original mutated the shared `sidebarLinks` array to splice the
          // user id in. That leaked across renders — once a profile id had been
          // written into the module-level constant, every later visitor got it.
          const href = resolveRoute(link.route, userId);
          const isActive = isRouteActive(link.route, pathname);

          return (
            <Link
              href={href}
              key={link.label}
              aria-current={isActive ? "page" : undefined}
              className={`nav-link group max-lg:justify-center ${
                isActive ? "nav-link-active" : ""
              }`}
            >
              <Icon
                name={link.icon}
                className="h-[22px] w-[22px] shrink-0 transition-transform duration-300 ease-spring group-hover:scale-110"
                strokeWidth={isActive ? 2.4 : 1.9}
              />
              <span className="max-lg:hidden">{link.label}</span>

              {/* The lit pill is the active state on wide screens; below lg the
                  labels are gone, so a dot carries it instead. */}
              {isActive && (
                <span className="absolute right-2 h-1.5 w-1.5 rounded-full bg-current opacity-70 lg:hidden" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-8 px-3 lg:px-4">
        <div className="mb-3 h-px bg-hairline" />
        <SignedIn>
          <SignOutButton signOutCallback={() => router.push("/sign-in")}>
            <button
              type="button"
              className="nav-link w-full text-fg-subtle hover:text-danger max-lg:justify-center"
            >
              <LogOut className="h-[22px] w-[22px] shrink-0" strokeWidth={1.9} />
              <span className="max-lg:hidden">Log out</span>
            </button>
          </SignOutButton>
        </SignedIn>
      </div>
    </section>
  );
};

export default LeftSidebar;
