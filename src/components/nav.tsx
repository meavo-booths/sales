import { MeavoNavBar } from "@meavo/navigation";
import {
  getAccessibleTools,
  getNotifications,
  resolveCurrentToolId,
  type MeavoAppKey,
} from "@meavo/navigation/server";
import { signOutAction } from "@/app/actions/auth";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  refreshNotificationsAction,
} from "@/app/actions/notifications";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// "sales" is not in the navigation package's MeavoAppKey union yet; the tool
// switcher matches by the card's linkedAppKey string, so the cast is safe.
const MEAVO_APP_KEY = (process.env.MEAVO_APP_KEY ?? "sales") as MeavoAppKey;

const GATEWAY_URL = process.env.GATEWAY_URL ?? "https://meavo.app";

const links = [
  { href: "/", label: "Quotes" },
  { href: "/deals", label: "Deals" },
  { href: "/clients", label: "Clients" },
  { href: "/products", label: "Products" },
];

export async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  });
  const admin = user?.systemRole === "ADMIN";

  const [toolOptions, notificationFeed] = await Promise.all([
    getAccessibleTools(prisma, {
      userId: session.user.id,
      isAdmin: admin,
      gatewayUrl: GATEWAY_URL,
    }),
    getNotifications(prisma, { userId: session.user.id }),
  ]);

  const navLinks = admin
    ? [
        ...links,
        { href: "/settings/xero", label: "Xero" },
        { href: "/settings/xero/us", label: "Xero US" },
      ]
    : links;

  return (
    <MeavoNavBar
      links={navLinks}
      logoHref={GATEWAY_URL}
      toolSwitcher={{
        currentId: resolveCurrentToolId(toolOptions, MEAVO_APP_KEY),
        options: toolOptions,
      }}
      userName={session.user.name}
      userEmail={session.user.email}
      userImage={session.user.image}
      signOutAction={signOutAction}
      notifications={{
        initial: notificationFeed,
        refresh: refreshNotificationsAction,
        markRead: markNotificationReadAction,
        markAllRead: markAllNotificationsReadAction,
      }}
    />
  );
}
