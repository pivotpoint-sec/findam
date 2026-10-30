import { NextResponse, type NextRequest } from "next/server";

// Protects /admin with HTTP basic auth (Next.js 16 "proxy", formerly middleware).
export function proxy(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  const header = req.headers.get("authorization");

  if (user && pass && header?.startsWith("Basic ")) {
    try {
      if (atob(header.slice(6)) === `${user}:${pass}`) return NextResponse.next();
    } catch {
      // fall through to the challenge
    }
  }
  return new NextResponse("Login required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FindAm admin", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
