import { inviteInfoHandler } from "@turvio/web-session";
import type { NextRequest } from "next/server";

export const GET = (req: NextRequest) => inviteInfoHandler(req.nextUrl.searchParams.get("token") ?? "");
