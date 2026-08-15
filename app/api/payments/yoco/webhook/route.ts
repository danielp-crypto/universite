import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyYocoWebhookSignature } from '@/lib/yoco/api';

const YOCO_WEBHOOK_SECRET = process.env.YOCO_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-yoco-webhook-signature');

    // Verify webhook signature if secret is configured
    if (YOCO_WEBHOOK_SECRET && signature) {
      const isValid = verifyYocoWebhookSignature(rawBody, signature, YOCO_WEBHOOK_SECRET);
      if (!isValid) {
        console.error('Yoco webhook signature verification failed');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    // Parse webhook data
    let webhookData;
    try {
      webhookData = JSON.parse(rawBody);
    } catch (e) {
      console.error('Failed to parse webhook data:', e);
      return new Response('Invalid JSON', { status: 400 });
    }

    console.log('Yoco webhook received:', webhookData);

    // Extract relevant data from webhook
    const eventType = webhookData.type || webhookData.event;
    const paymentData = webhookData.data || webhookData;

    if (eventType === 'payment.succeeded' || eventType === 'checkout.session.completed') {
      const paymentId = paymentData.id || paymentData.paymentId;
      const metadata = paymentData.metadata || {};
      const userId = metadata.userId;
      const planSlug = metadata.planSlug;
      const internalPaymentId = metadata.paymentId;

      if (!userId || !planSlug) {
        console.error('Missing required metadata in webhook:', metadata);
        return new Response('Missing metadata', { status: 400 });
      }

      // Get current subscription to check if this is an initial or a recurring payment
      const { data: currentSub } = await supabaseAdmin
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (currentSub && currentSub.status === 'active' && currentSub.plan_slug === planSlug) {
        // Recurring payment on the same plan the user is already active on — extend it
        const currentExpiry = new Date(currentSub.expires_at || new Date());
        const newExpiry = new Date(currentExpiry);

        if (planSlug.includes('month')) {
          newExpiry.setMonth(newExpiry.getMonth() + 1);
        } else if (planSlug.includes('year')) {
          newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        }

        const { error: updateError } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            expires_at: newExpiry.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error extending subscription:', updateError);
        }

        console.log('Subscription extended for user:', userId, 'New expiry:', newExpiry);
      } else {
        // Initial payment (or switching plans) - activate subscription
        const startedAt = new Date();
        const expiresAt = new Date();

        if (planSlug.includes('month')) {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else if (planSlug.includes('year')) {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        const { error: updateError } = await supabaseAdmin
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_slug: planSlug,
            status: 'active',
            yoco_payment_id: internalPaymentId || paymentId,
            yoco_checkout_id: paymentData.checkoutId,
            started_at: startedAt.toISOString(),
            expires_at: expiresAt.toISOString()
          });

        if (updateError) {
          console.error('Error activating subscription:', updateError);
        }

        console.log('Subscription activated for user:', userId, 'Expires:', expiresAt);
      }
    } else if (eventType === 'payment.failed' || eventType === 'checkout.session.failed') {
      const metadata = paymentData.metadata || {};
      const userId = metadata.userId;
      const internalPaymentId = metadata.paymentId;

      if (userId && internalPaymentId) {
        // Only cancel if this notification matches the subscription's own payment ID
        const { error: updateError } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: 'cancelled',
            plan_slug: 'free',
            yoco_payment_id: null,
            yoco_checkout_id: null,
            expires_at: null
          })
          .eq('user_id', userId)
          .eq('yoco_payment_id', internalPaymentId);

        if (updateError) {
          console.error('Error cancelling subscription:', updateError);
        }

        console.log('Subscription cancelled and downgraded to free for user:', userId);
      }
    }

    return new Response('OK');

  } catch (error: any) {
    console.error('Yoco webhook error:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
}
