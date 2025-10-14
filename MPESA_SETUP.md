# M-Pesa Integration Setup

## Prerequisites

1. **M-Pesa Developer Account**: Sign up at https://developer.safaricom.co.ke/
2. **Node.js Dependencies**: Install the required packages

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up M-Pesa credentials by creating a `.env` file in your project root:

```env
# M-Pesa API Configuration
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_BUSINESS_SHORTCODE=174379
MPESA_PASSKEY=your_passkey_here
MPESA_ENVIRONMENT=sandbox
BASE_URL=http://localhost:3000
```

## Getting M-Pesa Credentials

### For Sandbox (Testing):
1. Go to https://developer.safaricom.co.ke/
2. Create an account and log in
3. Create a new app
4. Get your Consumer Key and Consumer Secret
5. Use the test credentials:
   - Business Shortcode: `174379`
   - Passkey: Get from your app settings

### For Production (Live):
1. Complete the M-Pesa onboarding process
2. Get your live credentials from Safaricom
3. Update the environment variables with live values
4. Change `MPESA_ENVIRONMENT=production`

## How It Works

1. **User clicks "Pay"** on a pending payment
2. **Selects M-Pesa** as payment method
3. **Enters phone number** and amount
4. **System initiates STK Push** to user's phone
5. **User receives M-Pesa prompt** to enter PIN
6. **System polls for payment status** every 10 seconds
7. **Payment is confirmed** and request marked as paid
8. **User is notified** to rate the technician

## Testing

For testing, you can use:
- **Test Phone Number**: `254708374149`
- **Test Amount**: Any amount above 1 KES
- **Test PIN**: `1234` (for sandbox)

## Security Notes

- Never commit your `.env` file to version control
- Use environment variables for all sensitive data
- Implement proper error handling in production
- Add rate limiting for payment attempts
- Log all payment transactions for audit

## Troubleshooting

### Common Issues:

1. **"Invalid credentials"**: Check your Consumer Key and Secret
2. **"Phone number format error"**: Ensure phone number starts with 254 or 07
3. **"Payment timeout"**: Check your internet connection and M-Pesa service
4. **"Callback URL not accessible"**: Ensure your server is accessible from the internet

### Debug Mode:
Set `NODE_ENV=development` to see detailed logs.

## Production Deployment

1. Update all environment variables with production values
2. Ensure your server has a public IP/domain
3. Update the callback URL in your M-Pesa app settings
4. Test thoroughly before going live
5. Monitor payment logs and error rates
