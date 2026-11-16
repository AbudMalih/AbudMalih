"use client";

import { Button } from "@turvio/web-ui/ds";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useT } from "../lib/i18n/client";

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const t = useT();
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut();
      }}
    >
      <LogOut className="rtl:-scale-x-100" /> {t("shell.signOut")}
    </Button>
  );
}
