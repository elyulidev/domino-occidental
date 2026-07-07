import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Prevent open redirects — only allow relative paths
  let next = searchParams.get("next") ?? "/dashboard";
  if (!next.startsWith("/")) {
    next = "/dashboard";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";

      if (isLocal) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    // Exchange failed — forward the error message
    const errorMsg = encodeURIComponent(error.message || "unknown");
    return NextResponse.redirect(
      `${origin}/auth/error?error=${errorMsg}`,
    );
  }

  // No code in the URL — OAuth provider didn't send one
  return NextResponse.redirect(
    `${origin}/auth/error?error=${encodeURIComponent("missing_authorization_code")}`,
  );
}
