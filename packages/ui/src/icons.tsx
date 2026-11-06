import type { SVGProps } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Home01Icon, UserGroupIcon, TrophyIcon, Money03Icon, UserIcon, Search01Icon, Add01Icon, ArrowLeft01Icon, ArrowRight01Icon, ArrowDown01Icon,
  Tick02Icon, Cancel01Icon, Location01Icon, ThumbsUpIcon, PencilEdit01Icon, Tag01Icon, Calendar03Icon, ChartUpIcon, DashboardSquare01Icon, Share08Icon,
  Wallet01Icon, Chat01Icon, BirthdayCakeIcon, PlayIcon, Image01Icon, Camera01Icon, Settings01Icon, Notification01Icon, Logout01Icon, UserAdd01Icon,
  CreditCardIcon, Mail01Icon, Medal01Icon, RankingIcon, ViewIcon, ViewOffIcon,
} from "@hugeicons/core-free-icons";

/** Hugeicons (free set, MIT). One place maps our icon names to the library, so screens never import it directly. */
export type IconName =
  | "home" | "members" | "trophy" | "money" | "profile"
  | "search" | "plus" | "back" | "forward" | "chevron-down" | "check" | "close"
  | "pin" | "thumb" | "edit" | "tag" | "calendar" | "trend" | "grid" | "share" | "wallet"
  | "chat" | "cake" | "play" | "image" | "camera" | "settings" | "bell" | "logout" | "user-add" | "card" | "mail" | "medal" | "ranking" | "eye" | "eye-off";

const icons: Record<IconName, IconSvgElement> = {
  home: Home01Icon, members: UserGroupIcon, trophy: TrophyIcon, money: Money03Icon, profile: UserIcon,
  search: Search01Icon, plus: Add01Icon, back: ArrowLeft01Icon, forward: ArrowRight01Icon, "chevron-down": ArrowDown01Icon, check: Tick02Icon, close: Cancel01Icon,
  pin: Location01Icon, thumb: ThumbsUpIcon, edit: PencilEdit01Icon, tag: Tag01Icon, calendar: Calendar03Icon, trend: ChartUpIcon, grid: DashboardSquare01Icon, share: Share08Icon, wallet: Wallet01Icon,
  chat: Chat01Icon, cake: BirthdayCakeIcon, play: PlayIcon, image: Image01Icon, camera: Camera01Icon, settings: Settings01Icon, bell: Notification01Icon, logout: Logout01Icon, "user-add": UserAdd01Icon, card: CreditCardIcon, mail: Mail01Icon, medal: Medal01Icon, ranking: RankingIcon, eye: ViewIcon, "eye-off": ViewOffIcon,
};

export function Icon({ name, size = 24, strokeWidth = 1.8, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name" | "ref">) {
  return <HugeiconsIcon icon={icons[name]} size={size} strokeWidth={strokeWidth} color="currentColor" aria-hidden="true" focusable="false" {...rest} />;
}
