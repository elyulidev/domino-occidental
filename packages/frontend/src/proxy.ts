import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {AUTHENTICATED_HOME,
  getAuthRedirectUrl,
  isAuthRoute,
  isProtectedRoute,
} from "@/lib/supabase/proxy-rules";

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            // Supabase defaults to secure:true, which breaks on local HTTP
            secure: process.env.NODE_ENV === "production",
          });
        });
      },
    },
  });

  // Refresh session — getUser() verifies the JWT against Supabase Auth API.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect logged-in users away from auth-only routes (login/register).
  if (user && isAuthRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL(AUTHENTICATED_HOME, request.nextUrl.origin));
  }

  // Redirect unauthenticated users away from protected routes.
  if (!user && isProtectedRoute(request.nextUrl.pathname)) {
    const redirectUrl = getAuthRedirectUrl(
      request.nextUrl.pathname,
      request.nextUrl.origin,
    );
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
