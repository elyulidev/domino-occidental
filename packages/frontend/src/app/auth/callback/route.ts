import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Prevent open redirects — only allow relative paths
  let next = searchParams.get("next") ?? "/lobby";
  if (!next.startsWith("/")) {
    next = "/lobby";
  }

  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    const redirectUrl = isLocalEnv
      ? `${origin}${next}`
      : forwardedHost
        ? `https://${forwardedHost}${next}`
        : `${origin}${next}`;

    // Create the redirect response FIRST so we can set cookies on it
    const redirectResponse = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, {
              ...options,
              // Supabase defaults to secure:true, which breaks on local HTTP
              secure: process.env.NODE_ENV === "production",
            });
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure profile exists — GoTrue bypasses DB triggers, so the
      // trigger-based profile creation never fires for OAuth signups.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .rpc("create_profile_for_user", {
            user_id: user.id,
            user_metadata: user.user_metadata ?? {},
            user_email: user.email ?? "",
          });
        if (profileError) {
          console.error("create_profile_for_user RPC error:", profileError);
        }
      }

      return redirectResponse;
    }
  }
  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
