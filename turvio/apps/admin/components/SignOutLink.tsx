"use client";

import { signOut } from "../lib/session";

export function SignOutLink() {
  return (
    <button onClick={() => void signOut()} className="font-medium text-brand-600 hover:underline">
      Sign out
    </button>
  );
}
