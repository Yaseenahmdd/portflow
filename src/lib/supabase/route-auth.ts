import { createClient } from "@/lib/supabase/server";
import { canUseSupabaseDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";

type AuthenticatedRouteResult =
  | { userId: string; response: null }
  | { userId: null; response: Response };

export async function requireAuthenticatedRouteUser(): Promise<AuthenticatedRouteResult> {
  if (!isSupabaseConfigured() && !canUseSupabaseDemoMode()) {
    return {
      userId: null,
      response: Response.json(
        { success: false, error: "Authentication is unavailable" },
        { status: 503 }
      ),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      response: Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return { userId: user.id, response: null };
}
