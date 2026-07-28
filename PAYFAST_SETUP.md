# PayFast Payment Integration Setup

This document explains how to set up PayFast payment integration for the Universite application.

## Required Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# PayFast Configuration
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase

# Application URL (for callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting PayFast Credentials

1. **Sign up for PayFast**
   - Go to [https://www.payfast.co.za](https://www.payfast.co.za)
   - Create a merchant account
   - Complete the verification process

2. **Get Your Credentials**
   - Log in to your PayFast dashboard
   - Navigate to Settings → Developers
   - Copy your Merchant ID and Merchant Key
   - Set a passphrase in your PayFast settings (optional but recommended)

3. **Configure Webhook**
   - In PayFast dashboard, set your ITN (Instant Transaction Notification) URL to:
     ```
     https://your-domain.com/api/payments/payfast/webhook
     ```
   - For local development, use a service like ngrok to tunnel your localhost

## Database Schema

The payment system uses the following database tables:

### `plans`
- Stores subscription plan details (Free, Premium Monthly, Premium Yearly)
- Includes pricing, quotas, and features

### `user_subscriptions`
- Tracks user subscription status
- Links to PayFast payment IDs
- Stores subscription expiry dates

## How It Works

1. **User initiates payment**
   - User clicks "Subscribe" on pricing page
   - Frontend calls `/api/payments/payfast/create`
   - API generates payment data and PayFast signature

2. **Redirect to PayFast**
   - User is redirected to PayFast payment page
   - User completes payment

3. **Payment completion**
   - PayFast redirects to `/payment/success` or `/payment/cancelled`
   - PayFast sends webhook to `/api/payments/payfast/webhook`
   - Webhook verifies signature and updates subscription status

4. **Subscription activation**
   - User's subscription is marked as active
   - User gets access to premium features

## Testing

PayFast provides a sandbox environment for testing:
- Use sandbox credentials during development
- Test with small amounts (R1.00)
- Verify webhook callbacks work correctly

## Security Notes

- Never commit PayFast credentials to version control
- Use environment variables for all sensitive data
- Always verify PayFast webhook signatures
- Use HTTPS in production

## Troubleshooting

**Payment fails with "Invalid signature"**
- Check that your passphrase matches in PayFast settings
- Ensure all parameters are included in signature generation
- Verify parameter order is alphabetical

**Webhook not updating subscription**
- Check webhook URL is accessible from PayFast
- Verify signature verification logic
- Check database connection

**User not upgraded after payment**
- Verify webhook was received and processed
- Check subscription status in database
- Ensure user is logged in with correct account
