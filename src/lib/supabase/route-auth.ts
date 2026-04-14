import { createClient } from "@/lib/supabase/server";

type AuthenticatedRouteResult =
  | { userId: string; response: null }
  | { userId: null; response: Response };

export async function requireAuthenticatedRouteUser(): Promise<AuthenticatedRouteResult> {
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
