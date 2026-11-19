import { secureSessionProxy } from "@turvio/web-session";
import type { NextRequest } from "next/server";


const imgHosts: string[] = [];

/** Refreshes expired sessions, sends signed-out visitors to /login and sets the Content-Security-Policy. */
export function proxy(req: NextRequest) {
  return secureSessionProxy(req, { imgHosts, dev: process.env.NODE_ENV === "development" });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/).*)"] };
