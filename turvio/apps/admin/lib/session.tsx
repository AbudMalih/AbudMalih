"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface AdminSession {
  name: string;
  email: string;
  environment: string | null;
}

const Ctx = createContext<AdminSession | null>(null);

export function AdminSessionProvider({ value, children }: { value: AdminSession; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminSession(): AdminSession {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdminSession must be used inside <AdminSessionProvider>");
  return v;
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}
