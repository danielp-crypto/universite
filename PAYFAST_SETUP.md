# PayFast Payment Integration Setup

This document explains how to set up PayFast payment integration for the Universite application.

## Required Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# PayFast Configuration
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase (optional but recommended for security)
PAYFAST_SANDBOX=true (set to false for production)

# Application URL (for callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step-by-Step: Finding Your PayFast Credentials

### 1. Sign Up for PayFast
- Go to [https://www.payfast.co.za](https://www.payfast.co.za)
- Click "Register" in the top right corner
- Create a merchant account and complete verification

### 2. Get Your Merchant ID and Merchant Key

1. **Log in to your PayFast Dashboard**
   - Navigate to [https://www.payfast.co.za/login](https://www.payfast.co.za/login)

2. **Find Merchant ID**
   - Go to **Settings** → **Integration**
   - Your Merchant ID is displayed at the top of the page
   - It looks like: `10012345`

3. **Find Merchant Key**
   - On the same **Integration** page
   - Scroll down to the "Integration Key" section
   - Your Merchant Key is displayed there
   - It looks like: `abcdef1234567890abcdef1234567890`

### 4. Set Up Passphrase (Recommended for Security)

1. **Generate a Passphrase**
   - On the **Integration** page
   - Find the "Passphrase" section
   - Enter a secure passphrase (use a strong password generator)
   - Click "Save"

2. **Copy the Passphrase**
   - After saving, the passphrase will be displayed
   - Copy this exactly to your `.env.local` file
   - **Important:** This is the only time you'll see it - save it securely!

### 5. Configure Return URLs (Optional but Recommended)

In your PayFast dashboard under **Settings** → **Integration**:

- **Return URL**: `https://your-domain.com/payment/success`
- **Cancel URL**: `https://your-domain.com/payment/cancelled`
- **Notify URL**: `https://your-domain.com/api/payments/payfast/itn`

These can also be set dynamically in the API call (as implemented in the code).

## Using the PayFast Button Component

### Basic Usage

```tsx
import PayfastButton from '@/components/PayfastButton';

export default function PricingPage() {
  return (
    <PayfastButton
      amount={99.00}
      itemName="Premium Monthly Subscription"
      itemDescription="Access to all premium features"
      email="user@example.com"
      userId="user_123"
    >
      Subscribe Now - R99.00/month
    </PayfastButton>
  );
}
```

### Props

- `amount` (required): Payment amount in ZAR (e.g., 99.00)
- `itemName` (required): Name of the item being purchased (max 100 chars)
- `itemDescription` (optional): Description of the item (max 255 chars)
- `email` (optional): Buyer's email address
- `userId` (optional): Your internal user ID for tracking
- `className` (optional): Additional CSS classes for the button
- `children` (optional): Button text/content (defaults to "Pay Now")

## Testing with PayFast Sandbox

### What is Sandbox Mode?

PayFast provides a sandbox environment for testing payments without processing real transactions. This is essential for development and debugging.

### How to Enable Sandbox Mode

1. Set the environment variable in your `.env.local`:
   ```env
   PAYFAST_SANDBOX=true
   ```

2. The code will automatically use the sandbox URL: `https://sandbox.payfast.co.za/eng/process`

### Testing Checklist

1. **Test with Small Amounts**
   - Use amounts like R1.00 or R5.00 for testing
   - This avoids any accidental charges

2. **Test Successful Payment**
   - Click the PayFast button
   - Complete the checkout flow in the sandbox
   - Verify you're redirected to the success page
   - Check that the ITN webhook is received

3. **Test Cancelled Payment**
   - Start a payment
   - Click "Cancel" during checkout
   - Verify you're redirected to the cancel page

4. **Test Different Payment Methods**
   - Test with credit card (use test card numbers provided by PayFast)
   - Test with EFT (Instant EFT)
   - Test with other available methods

5. **Verify Webhook Processing**
   - Check your server logs for ITN webhook calls
   - Verify the signature validation works
   - Ensure database updates occur correctly

### Sandbox Test Cards

PayFast provides test card numbers for sandbox testing. Check the PayFast documentation for the latest test card numbers, but typically:

- **Visa**: 4111111111111111
- **Mastercard**: 5555555555554444
- **Expiry**: Any future date
- **CVV**: Any 3 digits

### Going Live

1. **Update Environment Variables**
   ```env
   PAYFAST_SANDBOX=false
   ```

2. **Verify Production URLs**
   - Ensure `NEXT_PUBLIC_APP_URL` is set to your production domain
   - Update return/notify URLs in PayFast dashboard if needed

3. **Test One More Time**
   - Run a final test with `PAYFAST_SANDBOX=true`
   - Verify everything works as expected

4. **Deploy to Production**
   - Deploy your application
   - Make a small real payment to verify the live integration

## Security Notes

- **Never commit credentials to version control**
  - Always use environment variables
  - Add `.env.local` to your `.gitignore` file

- **Always use HTTPS in production**
  - PayFast requires HTTPS for live transactions
  - Use a valid SSL certificate

- **Validate signatures on ITN webhooks**
  - The ITN endpoint should validate the signature
  - This prevents fraudulent webhook calls

- **Use a passphrase**
  - This adds an extra layer of security to your signature
  - Never share your passphrase

## Troubleshooting

### "PayFast credentials not configured"
- Verify `PAYFAST_MERCHANT_ID` and `PAYFAST_MERCHANT_KEY` are set in `.env.local`
- Restart your development server after changing environment variables

### "Invalid signature" error
- Check that your passphrase matches exactly (including case)
- Verify the signature generation logic matches PayFast's requirements
- Ensure you're not sorting the parameters for checkout signatures

### Payment redirects but webhook not received
- Check your `notify_url` is accessible from the internet
- For local development, use ngrok or similar tunneling service
- Verify PayFast can reach your server (check firewall settings)

### Sandbox payment fails
- Ensure `PAYFAST_SANDBOX=true` is set
- Verify you're using the sandbox URL
- Check PayFast sandbox status (sometimes it's down for maintenance)

## Additional Resources

- [PayFast Developer Documentation](https://developers.payfast.co.za/)
- [PayFast Integration Guide](https://www.payfast.co.za/integration-guide/)
- [PayFast Sandbox Testing](https://developers.payfast.co.za/#sandbox)
