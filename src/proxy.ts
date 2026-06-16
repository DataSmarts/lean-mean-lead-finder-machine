import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { webEnv as env } from "@/lib/env";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/services/auth";

// Telegram's servers reach this without a session; it is secured separately by
// its secret-token header (ARCHITECTURE.md §8). Both gates apply independently.
const PUBLIC_API_PATHS: ReadonlySet<string> = new Set(["/api/telegram/webhook"]);

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken({ token, secret: env.SESSION_SECRET }) : null;

  if (session?.valid) {
    return NextResponse.next();
  }

  if (isApiPath(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login).*)"],
};
