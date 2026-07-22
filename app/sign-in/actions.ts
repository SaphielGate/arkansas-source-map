"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextValue = String(formData.get("next") ?? "/");
  const destination = nextValue.startsWith("/") && !nextValue.startsWith("//") ? nextValue : "/";
  const { error } = await createClient().auth.signInWithPassword({ email, password });
  if (error) redirect(`/sign-in?error=${encodeURIComponent("Email or password was not accepted.")}`);
  redirect(destination);
}
