# Supabase Auth Setup for Next.js

## Environment Variables

Add these environment variables to your `.env.local` file:

```env
# Supabase Configuration (must use NEXT_PUBLIC_ prefix for client-side access)
NEXT_PUBLIC_SUPABASE_URL=https://hiruufvoyigrcdohqjkm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_oAbDFVc8dPgLnNaJQ-QKhg_PUDOyjZp

# AI Services (server-side only)
HUGGINGFACE_API_KEY=your_huggingface_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key

# Google Cloud (optional, server-side only)
GOOGLE_APPLICATION_CREDENTIALS=path_to_google_credentials.json
```

## Files Created

### Supabase Client (`lib/supabase/client.ts`)
- Client-side Supabase client for browser use
- Handles auth state and session persistence

### Supabase Server (`lib/supabase/server.ts`)
- Server-side Supabase client for API routes
- Uses cookie-based session management

### Auth Utilities (`lib/supabase/auth.ts`)
- Helper functions for auth operations:
  - `getSession()` - Get current session
  - `getAccessToken()` - Get JWT token for API calls
  - `requireAuth()` - Throw error if not authenticated
  - `signInWithOAuth()` - OAuth sign in (Google, Apple)
  - `signOut()` - Sign out user
  - `onAuthStateChange()` - Listen to auth state changes

### API Helper (`lib/api/client.ts`)
- Helper functions for API calls with automatic auth token inclusion:
  - `apiRequest()` - Generic API request with auth
  - `apiGet()` - GET request
  - `apiPost()` - POST request
  - `apiPut()` - PUT request
  - `apiDelete()` - DELETE request

## Updated Pages

### Login Page (`app/login/page.tsx`)
- Uses new Supabase client instead of window.UniSupabase
- Handles OAuth sign in with Google and Apple
- Redirects to home page after successful auth
- Listens to auth state changes

### Signup Page (`app/signup/page.tsx`)
- Uses new Supabase client instead of window.UniSupabase
- Handles OAuth sign up with Google and Apple
- Redirects to home page after successful auth

## Usage Example

```typescript
import { apiGet, apiPost } from '@/lib/api/client';

// Get lectures
const lectures = await apiGet('/api/lectures');

// Create lecture
const newLecture = await apiPost('/api/lectures', {
  title: 'My Lecture',
  description: 'Lecture description'
});
```

## Next Steps

1. Run `npm install` to install the new dependencies
2. Copy environment variables to `.env.local`
3. Test login/signup pages
4. Update other pages to use the new auth utilities
5. Remove old HTML-based auth files if no longer needed
