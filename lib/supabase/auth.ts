import { supabase } from './client'

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

export async function getAccessToken() {
  const session = await getSession()
  return session?.access_token || null
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }
  return session
}

export async function signInWithOAuth(provider: 'google' | 'apple', options?: { redirectTo?: string }) {
  return await supabase.auth.signInWithOAuth({
    provider,
    options: options?.redirectTo ? { redirectTo: options.redirectTo } : undefined,
  })
}

export async function signOut() {
  return await supabase.auth.signOut()
}

export async function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback)
}
