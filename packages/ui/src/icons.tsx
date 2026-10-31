import type { SVGProps } from "react";

export type IconName =
  | "home" | "members" | "trophy" | "money" | "profile"
  | "search" | "plus" | "back" | "chevron-down" | "check" | "close"
  | "pin" | "thumb" | "edit" | "tag" | "calendar" | "trend" | "grid" | "share" | "wallet";

const paths: Record<IconName, string> = {
  home: "M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10",
  members: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21c0-4 3-7 7-7s7 3 7 7M19 8v6M16 11h6",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4",
  money: "M3 7h18v10H3zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 10v.01M18 14v.01",
  profile: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.5-7 8-7s8 3 8 7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  back: "M19 12H5M11 6l-6 6 6 6",
  "chevron-down": "m6 9 6 6 6-6",
  check: "m5 12 5 5 9-10",
  close: "M6 6l12 12M18 6 6 18",
  pin: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  thumb: "M7 11v9H4v-9h3ZM7 11l4-8c2 0 3 1 3 3l-1 4h6a2 2 0 0 1 2 2l-1.5 6A2 2 0 0 1 17.5 20H7",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4",
  tag: "M3 12V4h8l10 10-8 8L3 12ZM7.5 8v.01",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  trend: "M3 17l6-6 4 4 8-9M15 6h6v6",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
  wallet: "M3 7h15a3 3 0 0 1 3 3v8H6a3 3 0 0 1-3-3V7ZM3 7l12-3v3M16 13h2",
};

export function Icon({ name, size = 24, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={paths[name]} />
    </svg>
  );
}
