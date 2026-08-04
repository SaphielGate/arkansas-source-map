import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account/update-password";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = safeNext(request.nextUrl.searchParams.get("next"));
  if (!code) {
    const url = new URL("/account/update-password", request.url);
    url.searchParams.set("error", "Recovery link is missing or invalid.");
    return NextResponse.redirect(url);
  }

  const { error } = await createClient().auth.exchangeCodeForSession(code);
  if (error) {
    const url = new URL("/account/update-password", request.url);
    url.searchParams.set("error", "This recovery link is invalid or has expired.");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
