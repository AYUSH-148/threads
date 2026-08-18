import Link from "next/link";
import { Pencil } from "lucide-react";

import Avatar from "./ui/Avatar";

interface HeaderProps {
  accountId: string;
  authUserId: string;
  name: string;
  username: string;
  imgUrl: string;
  bio: string;
  type?: string;
}

const ProfileHeader = ({
  accountId,
  authUserId,
  name,
  username,
  imgUrl,
  bio,
  type,
}: HeaderProps) => {
  const isOwner = accountId === authUserId && type !== "Community";

  return (
    <header className="surface-card relative overflow-hidden">
      {/* Cover band. The gradient is the brand ramp at low alpha so it reads as
          a tint of the page rather than a second brand colour. */}
      <div
        className="h-24 w-full sm:h-28"
        style={{
          backgroundImage:
            "linear-gradient(115deg, hsl(var(--accent-violet) / 0.85), hsl(var(--brand) / 0.75) 45%, hsl(var(--accent-aqua) / 0.8))",
        }}
      />

      <div className="px-5 pb-6 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* Pulled up over the cover band so the avatar straddles the seam. */}
          <div className="-mt-11 flex items-end gap-4 sm:-mt-12">
            <Avatar src={imgUrl} alt={name} size="xl" ring priority />

            <div className="min-w-0 pb-1">
              <h2 className="truncate font-display text-heading3-bold text-fg">
                {name}
              </h2>
              <p className="truncate text-base-medium text-fg-subtle">
                @{username}
              </p>
            </div>
          </div>

          {isOwner && (
            <Link href="/profile/edit" className="btn-soft mb-1 px-4 py-2">
              <Pencil className="h-4 w-4" strokeWidth={2.2} />
              <span className="max-xs:hidden">Edit profile</span>
            </Link>
          )}
        </div>

        {bio && (
          <p className="mt-5 max-w-xl whitespace-pre-wrap text-base-regular text-fg-muted">
            {bio}
          </p>
        )}
      </div>
    </header>
  );
};

export default ProfileHeader;
