const PLACEHOLDER_SUPABASE_URL = "your_supabase_project_url";

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(url && key && url !== PLACEHOLDER_SUPABASE_URL);
}

export function canUseSupabaseDemoMode() {
  return !isSupabaseConfigured() && process.env.NODE_ENV !== "production";
}
