const requiredPublicVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function getSupabaseEnv(environment: NodeJS.ProcessEnv = process.env) {
  const missing = requiredPublicVariables.filter((name) => !environment[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required Supabase environment variables: ${missing.join(", ")}`);
  }

  return {
    url: environment.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}
