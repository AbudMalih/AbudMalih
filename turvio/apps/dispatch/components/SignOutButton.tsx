"use client";

import { Button } from "@turvio/web-ui/ds";
import { LogOut } from "lucide-react";
import { useState } from "react";

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut();
      }}
    >
      <LogOut /> Sign out
    </Button>
  );
}
