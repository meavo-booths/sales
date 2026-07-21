import { redirect } from "next/navigation";
import { SALES_TOOL_CARD_ID } from "@/lib/constants";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setActorUserId } from "@/lib/request-context";

const TASKS_TOOL_CARD_ID = process.env.TASKS_TOOL_CARD_ID ?? "seed-tasks-tool";

export async function hasTasksAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });
  if (user?.systemRole === "ADMIN") return true;

  const access = await prisma.toolCardAccess.findFirst({
    where: { userId, cardId: TASKS_TOOL_CARD_ID },
  });
  return Boolean(access);
}

export async function requireSalesAccess() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await prisma.toolCardAccess.findFirst({
    where: { userId: session.user.id, cardId: SALES_TOOL_CARD_ID },
  });

  if (!access) redirect("/login?error=NoAccess");

  // Attribute any Deal writes in this request to the acting user (audit log).
  setActorUserId(session.user.id);

  return session;
}

/** Sales access + system ADMIN role — used for integration settings. */
export async function requireSalesAdmin() {
  const session = await requireSalesAccess();

  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { systemRole: true },
  });
  if (user?.systemRole !== "ADMIN") redirect("/");

  return session;
}
