// Yoco Payment API Integration
// Yoco uses a REST API with secret key authentication

const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY!;
const YOCO_PUBLIC_KEY = process.env.YOCO_PUBLIC_KEY!;
const YOCO_API_URL = 'https://online.yoco.com';

export interface YocoPaymentRequest {
  amountInCents: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface YocoPaymentResponse {
  id: string;
  status: string;
  amountInCents: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
  createdAt: string;
  source?: {
    id: string;
    type: string;
  };
}

export interface YocoCheckoutRequest {
  amountInCents: number;
  currency: string;
  itemName: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  metadata?: Record<string, string>;
}

export interface YocoCheckoutResponse {
  checkoutUrl: string;
  id: string;
}

export async function createYocoCheckout(
  checkoutData: YocoCheckoutRequest
): Promise<{ success: boolean; checkoutUrl?: string; id?: string; error?: string }> {
  try {
    console.log('Creating Yoco checkout with data:', checkoutData);
    console.log('Using Yoco API URL:', YOCO_API_URL);

    const response = await fetch(`${YOCO_API_URL}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutData),
    });

    console.log('Yoco API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yoco API error response:', errorText);
      return { success: false, error: `Yoco API error (${response.status}): ${errorText}` };
    }

    const data: YocoCheckoutResponse = await response.json();
    console.log('Yoco checkout created successfully:', data);
    return { success: true, checkoutUrl: data.checkoutUrl, id: data.id };
  } catch (error: any) {
    console.error('Yoco checkout creation error:', error);
    return { success: false, error: error.message };
  }
}

export async function getYocoPayment(paymentId: string): Promise<{
  success: boolean;
  payment?: YocoPaymentResponse;
  error?: string;
}> {
  try {
    const response = await fetch(`${YOCO_API_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Yoco API error: ${error}` };
    }

    const data: YocoPaymentResponse = await response.json();
    return { success: true, payment: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function verifyYocoWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret?: string
): boolean {
  // Yoco webhooks are signed with HMAC-SHA256
  // If webhook secret is configured, verify the signature
  if (!webhookSecret) {
    // If no webhook secret is configured, skip verification (not recommended for production)
    console.warn('Yoco webhook verification skipped - no webhook secret configured');
    return true;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

export interface RegisterWebhookRequest {
  name: string;
  notification_url: string;
  event_types: string[];
}

export interface RegisterWebhookResponse {
  id: string;
  name: string;
  notification_url: string;
  event_types: string[];
  secret: string; // This is only returned once, prefixed with whsec_
  active: boolean;
  created_at: string;
}

export async function registerYocoWebhook(
  webhookData: RegisterWebhookRequest
): Promise<{ success: boolean; webhook?: RegisterWebhookResponse; error?: string }> {
  try {
    console.log('Registering Yoco webhook:', webhookData);
    console.log('Using Yoco API URL:', YOCO_API_URL);

    // Try the newer v1 API first
    let response = await fetch(`${YOCO_API_URL}/v1/webhooks/subscriptions/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    console.log('Yoco v1 webhook registration response status:', response.status);

    // If v1 fails, try the older API
    if (!response.ok) {
      console.log('v1 API failed, trying older /api/webhooks endpoint');
      response = await fetch(`${YOCO_API_URL}/api/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: webhookData.name,
          url: webhookData.notification_url
        }),
      });

      console.log('Yoco legacy webhook registration response status:', response.status);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yoco webhook registration error:', errorText);
      return { success: false, error: `Yoco API error (${response.status}): ${errorText}` };
    }

    const data: RegisterWebhookResponse = await response.json();
    console.log('Yoco webhook registered successfully. SECRET (save this securely):', data.secret);
    return { success: true, webhook: data };
  } catch (error: any) {
    console.error('Yoco webhook registration error:', error);
    return { success: false, error: error.message };
  }
}
