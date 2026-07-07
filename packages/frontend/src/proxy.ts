import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  getAuthRedirectUrl,
  isProtectedRoute,
} from "@/lib/supabase/proxy-rules";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            response.cookies.set(name, value);
          });
        },
      },
    },
  );

  // Refresh session — getUser() verifies the JWT against Supabase Auth API.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

export const proxyConfig = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
