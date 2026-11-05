import { proxyHandler } from "@turvio/web-session";
import type { NextRequest } from "next/server";

// Browser -> TURVIO API with the session's access token (httpOnly cookie).
type Ctx = { params: Promise<{ path: string[] }> };
const handle = async (req: NextRequest, ctx: Ctx) => proxyHandler(req, (await ctx.params).path);

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const dynamic = "force-dynamic";
