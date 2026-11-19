"use client";

import { useT } from "../lib/i18n/client";
import { signOut } from "../lib/session";

export function SignOutLink() {
  const t = useT();
  return (
    <button onClick={() => void signOut()} className="font-medium text-brand-600 hover:underline">
      {t("shell.signOut")}
    </button>
  );
}
