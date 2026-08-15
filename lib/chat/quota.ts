import { supabaseAdmin } from '@/lib/supabase/client';

export interface LectureChatUsage {
  used: number;
  limit: number;
  isUnlimited: boolean;
  remaining: number | null; // null when unlimited
}

// Any plan's monthly_chat_messages value at or above this is treated as "no real
// limit" — same convention already used for lecture uploads / transcription
// minutes on the pricing page (see formatQuota in app/pricing/page.tsx).
const UNLIMITED_THRESHOLD = 900;

export async function getLectureChatUsage(userId: string, lectureId: string): Promise<LectureChatUsage> {
  const { data: subscription } = await supabaseAdmin
    .from('user_subscriptions')
    .select('plan_slug, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  // No active subscription row means the user has never upgraded — default to
  // free, matching the same fallback used in app/api/subscription/route.ts.
  const planSlug = subscription?.plan_slug || 'free';

  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('monthly_chat_messages')
    .eq('plan_slug', planSlug)
    .single();

  const limit = plan?.monthly_chat_messages ?? 0;
  const isUnlimited = limit >= UNLIMITED_THRESHOLD;

  const { count } = await supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('lecture_id', lectureId)
    .eq('user_id', userId)
    .eq('sender', 'user');

  const used = count ?? 0;

  return {
    used,
    limit,
    isUnlimited,
    remaining: isUnlimited ? null : Math.max(limit - used, 0),
  };
}