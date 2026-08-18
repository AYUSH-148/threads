import {
  Bell,
  Compass,
  Hash,
  Heart,
  Home,
  LogOut,
  MessageCircle,
  Pencil,
  Reply,
  Search,
  Share2,
  SquarePen,
  Tag,
  Trash2,
  User,
  UserPlus,
  Users,
  type LucideProps,
} from "lucide-react";

/**
 * Named icons, resolved from a string.
 *
 * The nav used to point at `/assets/*.svg` files rendered through next/image.
 * Every one of those had `fill="white"` baked into the markup, so they were
 * invisible the moment a light theme existed — and an <img> cannot inherit
 * `currentColor`. Inline SVG components can, which is what makes one icon set
 * work in both themes.
 */
export const ICONS = {
  home: Home,
  search: Search,
  compass: Compass,
  heart: Heart,
  bell: Bell,
  create: SquarePen,
  community: Users,
  user: User,
  logout: LogOut,
  reply: Reply,
  comment: MessageCircle,
  share: Share2,
  members: Users,
  request: UserPlus,
  tag: Tag,
  hash: Hash,
  edit: Pencil,
  delete: Trash2,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps extends LucideProps {
  name: IconName;
}

function Icon({ name, ...props }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph {...props} />;
}

export default Icon;
