import { getAccessToken } from '@/lib/supabase/auth';

export async function apiRequest(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export async function apiGet(url: string) {
  return apiRequest(url, { method: 'GET' });
}

export async function apiPost(url: string, data: any) {
  return apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiPut(url: string, data: any) {
  return apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiDelete(url: string) {
  return apiRequest(url, { method: 'DELETE' });
}
