import { redirect } from "next/navigation";
import { SALES_TOOL_CARD_ID } from "@/lib/constants";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireSalesAccess() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await prisma.toolCardAccess.findFirst({
    where: { userId: session.user.id, cardId: SALES_TOOL_CARD_ID },
  });

  if (!access) redirect("/login?error=NoAccess");

  return session;
}
