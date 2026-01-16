// Supabase client + tiny auth helpers for static HTML pages.
// NOTE: This file expects the Supabase UMD bundle to be loaded first:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

/* global supabase */

(function () {
  // Public (safe-to-embed) config. If you change projects, update these two values.
  const SUPABASE_URL = 'https://hiruufvoyigrcdohqjkm.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_oAbDFVc8dPgLnNaJQ-QKhg_PUDOyjZp';

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getAccessToken() {
    const session = await getSession();
    return session?.access_token || null;
  }

  async function requireAuth({ redirectTo = 'login.html' } = {}) {
    const session = await getSession();
    if (!session) {
      const url = new URL(window.location.href);
      const returnTo = `${url.pathname}${url.search}${url.hash}`;
      window.location.href = `${redirectTo}?returnTo=${encodeURIComponent(returnTo)}`;
      return null;
    }
    return session;
  }

  async function signInWithPassword(email, password) {
    return await client.auth.signInWithPassword({ email, password });
  }

  async function signUpWithPassword(email, password, { redirectTo } = {}) {
    return await client.auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
  }

  async function signInWithOAuth(provider, { redirectTo } = {}) {
    return await client.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    });
  }

  async function signOut() {
    return await client.auth.signOut();
  }

  // Expose a single namespace to pages.
  window.UniSupabase = {
    client,
    getSession,
    getAccessToken,
    requireAuth,
    signInWithPassword,
    signUpWithPassword,
    signInWithOAuth,
    signOut,
  };
})();

