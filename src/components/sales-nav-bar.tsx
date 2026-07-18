"use client";

import {
  MeavoNavBar,
  type NavLink,
  type NotificationsState,
  type ToolSwitcherState,
} from "@meavo/navigation";

const links: NavLink[] = [
  { href: "/", label: "Quotes" },
  { href: "/deals", label: "Deals" },
  { href: "/clients", label: "Clients" },
  { href: "/numbers", label: "Numbers" },
  { href: "/products", label: "Settings" },
];

const SETTINGS_SECTIONS = ["/products", "/settings/xero"];

function isActiveLink(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/products") {
    return SETTINGS_SECTIONS.some(
      (section) => pathname === section || pathname.startsWith(`${section}/`),
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SalesNavBar({
  logoHref,
  toolSwitcher,
  userName,
  userEmail,
  userImage,
  signOutAction,
  notifications,
}: {
  logoHref: string;
  toolSwitcher: ToolSwitcherState;
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  userImage?: string | null;
  signOutAction: () => void | Promise<void>;
  notifications?: NotificationsState;
}) {
  return (
    <MeavoNavBar
      links={links}
      logoHref={logoHref}
      toolSwitcher={toolSwitcher}
      userName={userName}
      userEmail={userEmail}
      userImage={userImage}
      signOutAction={signOutAction}
      notifications={notifications}
      isActiveLink={isActiveLink}
    />
  );
}
