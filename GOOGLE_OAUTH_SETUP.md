# Google OAuth integration (Supabase)

This project uses **Supabase** for auth. Google sign-in is handled by Supabase; you only need to configure the Google OAuth client in two places.

## 1. Google Cloud Console

Your OAuth client is already created. Ensure the **Authorized redirect URI** includes:

- `https://hiruufvoyigrcdohqjkm.supabase.co/auth/v1/callback`

(This matches the Supabase project in `js/supabase-client.js`.)

## 2. Supabase Dashboard

1. Open your [Supabase project](https://supabase.com/dashboard) → **Authentication** → **Providers**.
2. Enable **Google**.
3. From your `client_secret_*.json` file (e.g. `client_secret_299948162258-....apps.googleusercontent.com.json`), copy:
   - **Client ID** → paste into Supabase “Client ID” (value of `web.client_id` in the JSON).
   - **Client secret** → paste into Supabase “Client secret” (value of `web.client_secret` in the JSON).
4. Save.

## 3. Redirect URLs in Supabase

In **Authentication** → **URL Configuration**, add your app URLs to **Redirect URLs**, for example:

- `http://localhost:5500/home.html` (local)
- `https://your-production-domain.com/home.html`
- `https://your-production-domain.com/login.html`

After that, “Continue with Google” on `login.html` and “Sign up with Google” on `signup.html` will use this client.

## Security

- **Do not commit** the `client_secret_*.json` file. It is listed in `.gitignore`.
- The client secret is only entered in the Supabase Dashboard; the frontend never sees it.
