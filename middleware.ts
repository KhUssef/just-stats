import { NextRequest, NextResponse } from "next/server";

// Every route sits behind HTTP Basic auth. Any username is accepted; the
// password must equal STATS_PASSWORD. Without STATS_PASSWORD the dashboard
// refuses to serve at all, so a missing variable can never expose the data.

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function password(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const colon = decoded.indexOf(":");
    return colon === -1 ? null : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const expected = process.env.STATS_PASSWORD;
  if (!expected) {
    return new NextResponse("STATS_PASSWORD is not configured.", { status: 503 });
  }
  const given = password(req.headers.get("authorization"));
  if (given !== null && same(given, expected)) return NextResponse.next();
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="just-stats", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
