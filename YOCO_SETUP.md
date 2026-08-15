# Yoco Payment Integration Setup

This document explains how to set up Yoco payment integration for the Universite application.

## Required Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Yoco Configuration
YOCO_PUBLIC_KEY=your_public_key
YOCO_SECRET_KEY=your_secret_key
YOCO_WEBHOOK_SECRET=your_webhook_secret (optional but recommended)

# Application URL (for callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Yoco Credentials

1. **Sign up for Yoco**
   - Go to [https://yoco.com](https://yoco.com)
   - Create a merchant account
   - Complete the verification process

2. **Get Your Credentials**
   - Log in to your Yoco dashboard
   - Navigate to Settings → Developers
   - Copy your Public Key and Secret Key
   - Generate a webhook secret for secure webhook verification

3. **Configure Webhook**
   - In Yoco dashboard, set your webhook URL to:
     ```
     https://your-domain.com/api/payments/yoco/webhook
     ```
   - For local development, use a service like ngrok to tunnel your localhost

## Database Schema

The payment system uses the following database tables:

### `plans`
- Stores subscription plan details (Free, Premium Monthly, Premium Yearly)
- Includes pricing, quotas, and features

### `user_subscriptions`
- Tracks user subscription status
- Links to Yoco payment IDs and checkout IDs
- Stores subscription expiry dates

## How It Works

1. **User initiates payment**
   - User clicks "Subscribe" on pricing page
   - Frontend calls `/api/payments/yoco/create`
   - API creates a Yoco checkout session

2. **Redirect to Yoco**
   - User is redirected to Yoco checkout page
   - User completes payment

3. **Payment completion**
   - Yoco redirects to `/payment/success` or `/payment/cancelled`
   - Yoco sends webhook to `/api/payments/yoco/webhook`
   - Webhook verifies signature and updates subscription status

4. **Subscription activation**
   - User's subscription is marked as active
   - User gets access to premium features

## Testing

Yoco provides test mode for development:
- Use test credentials during development (keys starting with `pk_test_` and `sk_test_`)
- Test with small amounts (R1.00)
- Verify webhook callbacks work correctly

## Security Notes

- Never commit Yoco credentials to version control
- Use environment variables for all sensitive data
- Always verify Yoco webhook signatures when webhook secret is configured
- Use HTTPS in production

## Troubleshooting

**Payment fails with checkout creation error**
- Verify your Yoco secret key is correct
- Check that your account is active and can receive payments
- Ensure the amount is in cents (multiply ZAR amount by 100)

**Webhook not updating subscription**
- Check webhook URL is accessible from Yoco
- Verify signature verification logic
- Check database connection
- Review webhook payload structure in logs

**User not upgraded after payment**
- Verify webhook was received and processed
- Check subscription status in database
- Ensure user is logged in with correct account
- Check webhook event type matches expected values
