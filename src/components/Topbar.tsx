import { OrganizationSwitcher, SignedIn, SignOutButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Image from "next/image";
import Link from "next/link";

import NotificationBell from "./NotificationBell";
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
    <nav className='topbar'>
      <Link href='/' className='flex items-center gap-4'>
        <Image src='/logo.svg' alt='logo' width={28} height={28} />
        <p className='text-heading3-bold text-light-1 max-xs:hidden'>Threads</p>
      </Link>

      <div className='flex items-center gap-1'>
        <SignedIn>
          <NotificationBell initialCount={unreadCount} />
        </SignedIn>

        <div className='block md:hidden'>
          <SignedIn>
            <SignOutButton>
              <div className='flex cursor-pointer'>
                <Image
                  src='/assets/logout.svg'
                  alt='logout'
                  width={24}
                  height={24}
                />
              </div>
            </SignOutButton>
          </SignedIn>
        </div>

        <OrganizationSwitcher
          appearance={{
            baseTheme: dark,
            elements: {
              organizationSwitcherTrigger: "py-2 px-4",
            },
          }}
        />
      </div>
    </nav>
  );
}

export default Topbar;
