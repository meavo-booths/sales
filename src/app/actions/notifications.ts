"use server";

import type { NotificationFeed } from "@meavo/navigation";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@meavo/navigation/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function refreshNotificationsAction(): Promise<NotificationFeed> {
  const userId = await requireUserId();
  return getNotifications(prisma, { userId });
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const userId = await requireUserId();
  await markNotificationRead(prisma, { userId, notificationId });
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const userId = await requireUserId();
  await markAllNotificationsRead(prisma, { userId });
}
