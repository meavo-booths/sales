import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { SALES_TOOL_CARD_ID } from "@/lib/constants";
import { authConfig } from "@/lib/auth.config";
import { authorizeInvitedGoogleUser, isGoogleAuthEnabled } from "@/lib/google-auth";
import { prisma } from "@/lib/prisma";

const googleProvider = isGoogleAuthEnabled()
  ? Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    })
  : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [...(googleProvider ? [googleProvider] : [])],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const ok = await authorizeInvitedGoogleUser({
        user,
        account,
        name: user.name ?? (profile?.name as string | undefined),
        image: user.image ?? (profile?.picture as string | undefined),
        validate: async (existingUser) => {
          const access = await prisma.toolCardAccess.findFirst({
            where: { userId: existingUser.id, cardId: SALES_TOOL_CARD_ID },
          });
          return Boolean(access);
        },
      });

      if (!ok) {
        const email = user.email?.trim().toLowerCase();
        const existing = email
          ? await prisma.user.findUnique({ where: { email } })
          : null;
        if (existing) return "/login?error=NoAccess";
        return "/login?error=NotInvited";
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true, image: true },
        });
        session.user.name = dbUser?.name ?? null;
        session.user.email = dbUser?.email ?? session.user.email;
        session.user.image = dbUser?.image ?? null;
      }
      return session;
    },
  },
});
