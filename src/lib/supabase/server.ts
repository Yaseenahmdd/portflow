import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canUseSupabaseDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

type SupabaseCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, return a mock client stub
  if (!isSupabaseConfigured()) {
    if (!canUseSupabaseDemoMode()) {
      return {
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: new Error('Supabase is not configured'),
          }),
          signOut: async () => ({ error: new Error('Supabase is not configured') }),
          exchangeCodeForSession: async () => ({
            data: { session: null, user: null },
            error: new Error('Supabase is not configured'),
          }),
        },
      } as ReturnType<typeof createServerClient>;
    }

    return {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: 'demo-user',
              email: 'demo@portflow.app',
              app_metadata: {},
              user_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        }),
        signOut: async () => ({ error: null }),
        exchangeCodeForSession: async () => ({ data: { session: null, user: null }, error: null }),
      },
    } as ReturnType<typeof createServerClient>;
  }

  const cookieStore = await cookies();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are missing');
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: SupabaseCookie) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  });
}
