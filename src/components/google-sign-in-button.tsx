"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui";

export function GoogleSignInButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      Continue with Google
    </Button>
  );
}
