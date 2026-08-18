import Link from "next/link";

import Avatar from "./ui/Avatar";

interface Props {
  id: string;
  name: string;
  username: string;
  imgUrl: string;
  bio: string;
  members: {
    image: string;
  }[];
}

function CommunityCard({ id, name, username, imgUrl, bio, members }: Props) {
  const shown = members.slice(0, 4);
  const overflow = members.length - shown.length;

  return (
    <article className="community-card gradient-ring group">
      <div className="flex items-center gap-3">
        <Link href={`/communities/${id}`} className="shrink-0">
          <Avatar src={imgUrl} alt={name} size="lg" />
        </Link>

        <div className="min-w-0">
          <Link href={`/communities/${id}`}>
            <h4 className="truncate font-display text-base-semibold text-fg transition-colors duration-200 group-hover:text-brand">
              {name}
            </h4>
          </Link>
          <p className="truncate text-small-medium text-fg-subtle">@{username}</p>
        </div>
      </div>

      {/* Clamped rather than left to run: the cards sit in a wrapping grid and
          one long bio would otherwise stretch its whole row. */}
      <p className="mt-4 line-clamp-2 min-h-[2.5rem] text-small-regular text-fg-muted">
        {bio || "No description yet."}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/communities/${id}`}>
          <span className="community-card_btn">View</span>
        </Link>

        {members.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="flex items-center">
              {shown.map((member, index) => (
                <span
                  key={index}
                  className={index !== 0 ? "-ml-2" : undefined}
                  style={{ zIndex: shown.length - index }}
                >
                  <Avatar
                    src={member.image}
                    alt=""
                    size="sm"
                    className="ring-2 ring-surface"
                  />
                </span>
              ))}
            </span>
            {overflow > 0 && (
              <span className="text-subtle-medium text-fg-subtle">
                +{overflow}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default CommunityCard;
