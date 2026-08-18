"use client";

import { useRouter } from "next/navigation";

import Avatar from "./ui/Avatar";

interface Props {
  id: string;
  name: string;
  username: string;
  imgUrl: string;
  personType: string;
}

function UserCard({ id, name, username, imgUrl, personType }: Props) {
  const router = useRouter();

  const isCommunity = personType === "Community";
  const href = isCommunity ? `/communities/${id}` : `/profile/${id}`;

  return (
    <article
      className="user-card cursor-pointer"
      onClick={() => router.push(href)}
    >
      <div className="user-card_avatar min-w-0">
        <Avatar src={imgUrl} alt={name} size="lg" />

        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-base-semibold text-fg">
            {name}
          </h4>
          <p className="truncate text-small-medium text-fg-subtle">@{username}</p>
        </div>
      </div>

      <button
        type="button"
        className="user-card_btn"
        onClick={(event) => {
          // The whole card is clickable; without this the button's click also
          // bubbles to the card handler and fires the same navigation twice.
          event.stopPropagation();
          router.push(href);
        }}
      >
        View
      </button>
    </article>
  );
}

export default UserCard;
