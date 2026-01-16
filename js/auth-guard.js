// Redirects to login if there is no Supabase session.
// Requires `js/supabase-client.js` to be loaded first.

(function () {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!window.UniSupabase) return;
      await window.UniSupabase.requireAuth({ redirectTo: 'login.html' });
    } catch (e) {
      console.error('Auth guard error:', e);
      // Fail closed: send to login.
      window.location.href = 'login.html';
    }
  });
})();

