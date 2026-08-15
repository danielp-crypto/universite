import { NextRequest, NextResponse } from 'next/server';
import { registerYocoWebhook } from '@/lib/yoco/api';

const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(request: NextRequest) {
  try {
    console.log('Yoco webhook registration request received');

    const webhookUrl = `${NEXT_PUBLIC_APP_URL}/api/payments/yoco/webhook`;
    console.log('Webhook URL:', webhookUrl);

    const result = await registerYocoWebhook({
      name: 'Universite Payment Webhook',
      notification_url: webhookUrl,
      event_types: [
        'payment.succeeded',
        'payment.failed',
        'checkout.session.completed',
        'checkout.session.failed'
      ]
    });

    if (!result.success) {
      console.error('Webhook registration failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to register webhook', details: result.error },
        { status: 500 }
      );
    }

    console.log('Webhook registered successfully');
    return NextResponse.json({
      success: true,
      webhook: result.webhook,
      message: 'Webhook registered successfully. IMPORTANT: Save the secret securely as it will not be shown again.'
    });

  } catch (error: any) {
    console.error('Webhook registration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
