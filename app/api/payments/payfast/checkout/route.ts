import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// PayFast checkout signature generation (NOT sorted, unlike REST API)
// This follows the standard form-field signature for on-site checkout
function generateCheckoutSignature(data: Record<string, string>): string {
  // Remove signature field if present
  const { signature, ...dataToSign } = data;
  
  // Get passphrase from env
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  
  // Add passphrase if configured
  if (passphrase) {
    dataToSign.passphrase = passphrase;
  }
  
  // Create parameter string - IMPORTANT: do NOT sort for checkout signature
  const paramString = Object.keys(dataToSign)
    .map((key) => `${key}=${encodeURIComponent(dataToSign[key]).replace(/%20/g, '+')}`)
    .join('&');
  
  return crypto.createHash('md5').update(paramString).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, item_name, item_description, email, user_id, subscription_type, recurring_amount, cycles, frequency } = body;

    // Validate required fields
    if (!amount || !item_name) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, item_name' },
        { status: 400 }
      );
    }

    // Get PayFast credentials from environment
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const isSandbox = process.env.PAYFAST_SANDBOX === 'true';

    if (!merchantId || !merchantKey) {
      return NextResponse.json(
        { error: 'PayFast credentials not configured' },
        { status: 500 }
      );
    }

    // Build payment data
    const paymentData: Record<string, string> = {
      // Merchant credentials
      merchant_id: merchantId,
      merchant_key: merchantKey,
      
      // Transaction details
      amount: amount.toFixed(2),
      item_name: item_name.substring(0, 100), // Max 100 chars
      item_description: (item_description || '').substring(0, 255), // Max 255 chars
      
      // Buyer details (optional but recommended)
      email_address: email || '',
      
      // Return URLs
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/cancelled`,
      notify_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/payments/payfast/itn`,
      
      // Custom data for your reference
      custom_int1: user_id || '',
      
      // Payment method (optional - leave empty for all methods)
      payment_method: '',
    };

    // Add subscription parameters if provided
    if (subscription_type) {
      paymentData.subscription_type = subscription_type.toString();
    }
    if (recurring_amount) {
      paymentData.recurring_amount = recurring_amount.toFixed(2);
    }
    if (cycles !== undefined) {
      paymentData.cycles = cycles.toString();
    }
    if (frequency !== undefined) {
      paymentData.frequency = frequency.toString();
    }

    // Generate signature
    const signature = generateCheckoutSignature(paymentData);
    paymentData.signature = signature;

    // Determine PayFast URL
    const payfastUrl = isSandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';

    return NextResponse.json({
      success: true,
      payfast_url: payfastUrl,
      payment_data: paymentData,
      is_sandbox: isSandbox,
    });

  } catch (error: any) {
    console.error('PayFast checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate checkout data' },
      { status: 500 }
    );
  }
}
