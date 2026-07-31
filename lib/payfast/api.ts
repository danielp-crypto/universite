import crypto from 'crypto';

// PayFast's Subscriptions REST API uses its own signed-header scheme —
// distinct from the form-field signature used for checkout/ITN. Headers are
// sorted alphabetically before hashing (per PayFast's own reference examples
// for this API, unlike the checkout signature which must NOT be sorted).
//
// PAYFAST_SANDBOX only controls the `testing=true` query param — your
// merchant ID and passphrase are always your own real credentials from env
// vars. There is no shared "generic" sandbox account to fall back to.
const PAYFAST_SANDBOX = process.env.PAYFAST_SANDBOX === 'true';
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID!;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';

function generateApiSignature(headers: Record<string, string>): string {
  const withPassphrase: Record<string, string> = { ...headers };
  if (PAYFAST_PASSPHRASE) {
    withPassphrase.passphrase = PAYFAST_PASSPHRASE;
  }

  const paramString = Object.keys(withPassphrase)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(withPassphrase[key]).replace(/%20/g, '+')}`)
    .join('&');

  return crypto.createHash('md5').update(paramString).digest('hex');
}

interface PayfastApiResult {
  ok: boolean;
  status?: number;
  error?: string;
}

async function callSubscriptionEndpoint(
  path: string,
  method: 'GET' | 'PUT' | 'PATCH' | 'POST'
): Promise<PayfastApiResult> {
  // PayFast timestamps must be YYYY-MM-DDTHH:MM:SS with no milliseconds.
  const timestamp = new Date().toISOString().split('.')[0];

  const signedHeaders = {
    'merchant-id': PAYFAST_MERCHANT_ID,
    version: 'v1',
    timestamp,
  };

  const signature = generateApiSignature(signedHeaders);
  const url = `https://api.payfast.co.za${path}${PAYFAST_SANDBOX ? '?testing=true' : ''}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...signedHeaders,
        signature,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, status: response.status, error: `PayFast API error (${response.status}): ${text}` };
    }

    return { ok: true, status: response.status };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// Cancels a recurring subscription at PayFast's end, given the subscription
// token stored on the user_subscriptions row. This is the step that actually
// stops future billing — updating our own database alone does not.
export async function cancelPayfastSubscription(subscriptionToken: string): Promise<PayfastApiResult> {
  return callSubscriptionEndpoint(`/subscriptions/${subscriptionToken}/cancel`, 'PUT');
}