import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, return a mock client
  if (!url || !key || url === 'your_supabase_project_url') {
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

  return createBrowserClient(url, key);
}
