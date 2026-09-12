import { NextResponse, type NextRequest } from "next/server";

/** Gate /office/* behind the signed session cookie (see lib/office-auth). */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/office") || pathname.startsWith("/office/login")) return NextResponse.next();
  if (!process.env.OFFICE_PASSCODE) return NextResponse.next();
  const cookie = req.cookies.get("wade_office")?.value;
  const [exp] = (cookie ?? "").split(".");
  // Signature is verified in server components/routes; middleware only checks presence + expiry (edge runtime has no node:crypto).
  if (!cookie || Number(exp) < Date.now()) {
    const url = req.nextUrl.clone();
    url.pathname = "/office/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/office/:path*"] };
