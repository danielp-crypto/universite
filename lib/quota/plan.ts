import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// One place that answers "what is this student allowed to do?".
//
// Before this file existed, "is this user premium?" was worked out separately
// in start-processing, modules, exam/sessions and the assistant page, and the
// tutor message limit only existed in the browser. Every route that spends
// money (Groq tokens, Deepgram minutes, embeddings) should call getPlanAccess()
// and use POLICY, so the rules cannot drift apart again.
//
// A null limit means "unlimited".
// ---------------------------------------------------------------------------

export interface PlanPolicy {
  // Lectures a student may have processed, counted over their lifetime.
  lifetimeLectures: number | null;
  // Longest single lecture, in minutes.
  maxLectureMinutes: number;
  // Tutor messages per lecture.
  lectureChatMessages: number | null;
  // Assignments a student may analyse (counted while they exist).
  assignments: number | null;
  // Coach messages per assignment.
  assignmentChatMessages: number | null;
  // Practice exams a student may create, counted over their lifetime.
  exams: number | null;
}

// These numbers match what the landing page promises today: 4 lectures
// (lifetime), 60 minutes per lecture, 10 tutor messages per lecture, and 2
// exams on Free; unlimited lectures, 90 minutes per lecture, unlimited tutor
// messages and unlimited exams on Premium. The two assignment limits are new
// (assignments are not on the landing page yet), so change them freely.
export const POLICY: { free: PlanPolicy; premium: PlanPolicy } = {
  free: {
    lifetimeLectures: 4,
    maxLectureMinutes: 60,
    lectureChatMessages: 10,
    assignments: 3,
    assignmentChatMessages: 10,
    exams: 2,
  },
  premium: {
    lifetimeLectures: null,
    maxLectureMinutes: 90,
    lectureChatMessages: null,
    assignments: null,
    assignmentChatMessages: null,
    exams: null,
  },
};

// A renewal webhook can arrive a little after expires_at, so a paying student
// is not locked out in the gap. After this grace period an unpaid plan lapses
// back to Free automatically.
const EXPIRY_GRACE_DAYS = 3;

export interface PlanAccess {
  isPremium: boolean;
  planSlug: string;
  expiresAt: string | null;
  policy: PlanPolicy;
}

function freeAccess(): PlanAccess {
  return { isPremium: false, planSlug: 'free', expiresAt: null, policy: POLICY.free };
}

export function isSubscriptionExpired(expiresAt: string | null, now: number = Date.now()): boolean {
  if (!expiresAt) return false; // no expiry date means it does not lapse
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return true; // an unreadable date must not grant premium
  return expiry + EXPIRY_GRACE_DAYS * 24 * 60 * 60 * 1000 < now;
}

// Premium requires ALL of: an active subscription, a paid plan, and an expiry
// date that has not passed. A pending checkout, a paused or cancelled plan, or
// a lookup failure is treated as Free, so the safe failure is never "free
// premium".
export async function getPlanAccess(userId: string): Promise<PlanAccess> {
  const { data: subscription, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('status, plan_slug, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[quota] Could not read subscription, treating as free:', error);
    return freeAccess();
  }

  if (
    !subscription ||
    subscription.status !== 'active' ||
    !subscription.plan_slug ||
    subscription.plan_slug === 'free' ||
    isSubscriptionExpired(subscription.expires_at)
  ) {
    return freeAccess();
  }

  return {
    isPremium: true,
    planSlug: subscription.plan_slug,
    expiresAt: subscription.expires_at,
    policy: POLICY.premium,
  };
}

// 402 Payment Required: the request is fine, the plan just does not cover it.
export function limitReachedResponse(
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json({ success: false, error: code, message, ...extra }, { status: 402 });
}
