import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  console.log("🔵 CALLBACK HIT:", request.url);
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  console.log("🔵 CALLBACK CODE:", code);

  // Prevent open redirects — only allow relative paths
  let next = searchParams.get("next") ?? "/lobby";
  if (!next.startsWith("/")) {
    next = "/lobby";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("exchangeCodeForSession ERROR", error);
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

      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }
  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
