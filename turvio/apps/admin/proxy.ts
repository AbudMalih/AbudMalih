import { sessionProxy } from "@turvio/web-session";
import type { NextRequest } from "next/server";

/** Refreshes expired sessions and sends signed-out visitors to /login. */
export function proxy(req: NextRequest) {
  return sessionProxy(req);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/).*)"] };
