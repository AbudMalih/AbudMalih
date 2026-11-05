import { forgotHandler } from "@turvio/web-session";
import type { NextRequest } from "next/server";

export const POST = (req: NextRequest) => forgotHandler(req, "admin");
