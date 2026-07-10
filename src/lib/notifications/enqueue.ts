import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type EnqueueNotificationInput = {
  sourceApp: string;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
};

async function isNotificationEventEnabled(eventType: string): Promise<boolean> {
  const setting = await prisma.notificationEventSetting.findUnique({
    where: { eventType },
    select: { enabled: true },
  });
  return setting?.enabled ?? true;
}

/**
 * Queues an event in the shared NotificationOutbox. The gateway cron picks it
 * up, resolves recipients, and fans out to email / bell / Slack.
 */
export async function enqueueNotification(input: EnqueueNotificationInput): Promise<void> {
  const enabled = await isNotificationEventEnabled(input.eventType);
  if (!enabled) return;

  try {
    await prisma.notificationOutbox.create({
      data: {
        sourceApp: input.sourceApp,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey ?? null,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (
      input.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}
