import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 forces the browser to follow with GET (307 preserves POST → 405 on page routes)
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
