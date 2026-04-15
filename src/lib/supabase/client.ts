import { createBrowserClient } from '@supabase/ssr';
import { canUseSupabaseDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, return a mock client
  if (!isSupabaseConfigured()) {
    if (!canUseSupabaseDemoMode()) {
      return {
        auth: {
          signInWithPassword: async () => ({
            data: { user: null, session: null },
            error: new Error('Supabase is not configured'),
          }),
          signUp: async () => ({
            data: { user: null, session: null },
            error: new Error('Supabase is not configured'),
          }),
          signOut: async () => ({ error: new Error('Supabase is not configured') }),
          getUser: async () => ({
            data: { user: null },
            error: new Error('Supabase is not configured'),
          }),
        },
      } as ReturnType<typeof createBrowserClient>;
    }

    return {
      auth: {
        signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
        signUp: async () => ({ data: { user: null, session: null }, error: null }),
        signOut: async () => ({ error: null }),
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
      },
    } as ReturnType<typeof createBrowserClient>;
  }

  if (!url || !key) {
    throw new Error('Supabase environment variables are missing');
  }

  return createBrowserClient(url, key);
}
