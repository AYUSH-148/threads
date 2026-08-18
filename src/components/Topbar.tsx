import { OrganizationSwitcher, SignedIn, SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import Link from "next/link";

import BrandMark from "./BrandMark";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./theme/ThemeToggle";
import { getCurrentUserId } from "@/lib/auth";
import { countUnread } from "@/lib/notifications/service";

async function Topbar() {
  // Rendered server-side so the badge is correct on first paint; the client
  // component takes over from there via SSE against the API service.
  //
  // The query module directly rather than the API over HTTP: this already runs on
  // a server that can reach MongoDB, so a request to our own service would add a
  // network round trip to every page render and a second way for the nav bar to
  // fail. The API and the page share the query, not the transport.
  const userId = await getCurrentUserId();
  const unreadCount = userId ? await countUnread(userId) : 0;

  return (
    <nav className="topbar">
      <Link
        href="/"
        className="group flex items-center gap-2.5 rounded-pill px-1 py-1"
        aria-label="Relay home"
      >
        <BrandMark
          size={28}
          gradientId="relayTopbarMark"
          className="transition-transform duration-400 ease-spring group-hover:rotate-12 group-hover:scale-110"
        />
        <span className="font-display text-heading3-bold tracking-tight text-fg max-xs:hidden">
          Relay
        </span>
      </Link>

      <div className="flex items-center gap-1">
        <ThemeToggle />

        <SignedIn>
          <NotificationBell initialCount={unreadCount} />
        </SignedIn>

        {/* The sidebar carries the sign-out control on desktop; below md it is
            hidden, so the topbar takes over. */}
        <div className="md:hidden">
          <SignedIn>
            <SignOutButton>
              <button type="button" className="icon-btn" aria-label="Sign out">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </SignOutButton>
          </SignedIn>
        </div>

        <div className="ml-1">
          <OrganizationSwitcher
            afterCreateOrganizationUrl="/communities"
            afterLeaveOrganizationUrl="/communities"
          />
        </div>
      </div>
    </nav>
  );
}

export default Topbar;
