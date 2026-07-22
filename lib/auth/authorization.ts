import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export async function getUserContext() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, role: data?.role ?? null };
}

export async function requireRole(allowedRoles: AppRole[]) {
  const context = await getUserContext();
  if (!context.user) redirect("/sign-in");
  if (!context.role || !allowedRoles.includes(context.role)) redirect("/unauthorized");
  return context;
}
