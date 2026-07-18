import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsNav } from "@/components/settings-nav";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let admin = false;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    });
    admin = user?.systemRole === "ADMIN";
  }

  return (
    <div className="space-y-6">
      <SettingsNav admin={admin} />
      {children}
    </div>
  );
}
