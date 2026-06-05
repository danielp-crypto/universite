// Redirects to login if there is no Supabase session.
// Requires `js/supabase-client.js` to be loaded first.

(function () {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!window.UniSupabase) {
        console.error('UniSupabase not available');
        window.location.href = 'login.html';
        return;
      }

      console.log('Auth guard: Checking session...');
      
      // Wait a moment for session to be restored from localStorage
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const session = await window.UniSupabase.getSession();
      
      if (!session) {
        console.log('Auth guard: No session found, redirecting to login');
        
        // Store the current URL for redirect after login
        const url = new URL(window.location.href);
        const returnTo = `${url.pathname}${url.search}${url.hash}`;
        window.location.href = `login.html?returnTo=${encodeURIComponent(returnTo)}`;
        return;
      }
      
      console.log('Auth guard: Session found for user:', session.user.email);
      
      // Set up session change listener
      window.UniSupabase.client.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session ? 'session exists' : 'no session');
        
        if (event === 'SIGNED_OUT' || !session) {
          console.log('User signed out, redirecting to login');
          window.location.href = 'login.html';
        }
      });
      
    } catch (e) {
      console.error('Auth guard error:', e);
      // Fail closed: send to login.
      window.location.href = 'login.html';
    }
  });
})();

