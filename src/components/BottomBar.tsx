"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import Icon from "./ui/Icon";
import { isRouteActive, resolveRoute } from "./LeftSidebar";
import { sidebarLinks } from "@/constants";

const BottomBar = () => {
  const pathname = usePathname();
  const { userId } = useAuth();

  return (
    <nav className="bottombar">
      <div className="flex items-center justify-around gap-1">
        {sidebarLinks.map((link) => {
          // Shares the sidebar's matcher. This used to be a bare
          // `pathname.includes(link.route)`, which matched "/" against every
          // route and lit Home on every page.
          const href = resolveRoute(link.route, userId);
          const isActive = isRouteActive(link.route, pathname);

          return (
            <Link
              href={href}
              key={link.label}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-all duration-250 ease-smooth active:scale-95 ${
                isActive ? "text-brand" : "text-fg-subtle"
              }`}
            >
              <Icon
                name={link.icon}
                className={`h-[21px] w-[21px] transition-transform duration-300 ease-spring ${
                  isActive ? "-translate-y-px scale-110" : ""
                }`}
                strokeWidth={isActive ? 2.4 : 1.9}
              />
              <span className="text-[10px] font-semibold leading-none max-xs:hidden">
                {link.shortLabel}
              </span>

              {isActive && (
                <span className="absolute inset-x-4 top-0 h-[2px] animate-scale-in rounded-full bg-brand" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomBar;
