# Supabase setup (Auth + User DB + Usage quotas)

This project uses Supabase for:
- **Auth**: email/password + Google/Apple OAuth
- **User database**: `public.profiles`
- **Usage quotas**: `public.usage_events` + `public.consume_quota()` RPC

## 1) Supabase project settings

In your Supabase dashboard:

- **Auth → URL Configuration**
  - Set **Site URL** to your production origin (currently: `https://master.dopnvb05t610g.amplifyapp.com`)
  - Add **Redirect URLs** for local dev (example: `http://localhost:5500/home.html`, `http://127.0.0.1:5500/home.html`)
  - Add production redirect URLs: `https://master.dopnvb05t610g.amplifyapp.com/home.html`, `https://master.dopnvb05t610g.amplifyapp.com/login.html`

- **Auth → Providers**
  - **Google**: Use the client ID and client secret from your `client_secret_*.json` file (fields `web.client_id` and `web.client_secret`). See **GOOGLE_OAUTH_SETUP.md** for step-by-step instructions. Redirect URI in Google Cloud must be `https://hiruufvoyigrcdohqjkm.supabase.co/auth/v1/callback`.
  - Enable **Apple** (add Services ID / Key / Team ID etc.)

If you want multi-step signup to work without email confirmation blocking sessions, either:
- Disable email confirmations (Auth → Providers → Email), or
- Update the onboarding flow to handle confirmation-required users (not done yet).

## 2) Create the database schema

Run the SQL in:
- `supabase/schema.sql`

This creates:
- `public.profiles` (+ trigger to auto-create on new users)
- `public.plans`, `public.user_subscriptions` (default `free`)
- `public.usage_events` + `public.consume_quota()` RPC

## 3) Backend environment variables

The Flask backend requires these env vars:

- `SUPABASE_URL` = your project URL (example: `https://hiruufvoyigrcdohqjkm.supabase.co`)
- `SUPABASE_ANON_KEY` = your **publishable/anon** API key
- `GEMINI_API_KEY` = your Gemini API key (already supported)

Example (PowerShell):

```powershell
$env:SUPABASE_URL="https://hiruufvoyigrcdohqjkm.supabase.co"
$env:SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
$env:GEMINI_API_KEY="YOUR_GEMINI_KEY"
python api.py
```

## 4) Frontend configuration

The frontend reads Supabase config from:
- `js/supabase-client.js`

It also enforces “must be logged in” on protected pages via:
- `js/auth-guard.js`

## 5) Quotas

Quotas are enforced server-side in `api.py` by calling the Supabase RPC:
- `consume_quota('chat_messages', 1)` for `/api/chat`
- `consume_quota('flashcard_generations', 1)` for `/api/generate-flashcards`

Adjust limits in `public.plans` (see `supabase/schema.sql`).

