import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

const publicPaths = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow auth API routes (login, callback, etc.)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow public pages
  if (publicPaths.has(pathname)) {
    // If already logged in, redirect to dashboard
    if (req.auth) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Allow static assets and API routes that handle their own auth
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Protected pages: redirect to login if not authenticated
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)"],
};
