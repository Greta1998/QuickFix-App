const axios = require('axios');
const crypto = require('crypto');

// M-Pesa API Configuration
const MPESA_CONFIG = {
    // Sandbox credentials - replace with production credentials
    consumerKey: process.env.MPESA_CONSUMER_KEY || 'test_consumer_key',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'test_consumer_secret',
    businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE || '174379', // Sandbox shortcode
    passkey: process.env.MPESA_PASSKEY || 'test_passkey',
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
    baseURL: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke'
};

class MpesaService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // Generate access token
    async getAccessToken() {
        try {
            // Debug: Check if credentials are set
            console.log('M-Pesa Config:', {
                consumerKey: MPESA_CONFIG.consumerKey ? 'SET' : 'NOT SET',
                consumerSecret: MPESA_CONFIG.consumerSecret ? 'SET' : 'NOT SET',
                businessShortCode: MPESA_CONFIG.businessShortCode,
                environment: MPESA_CONFIG.environment,
                baseURL: MPESA_CONFIG.baseURL
            });

            // Check if using test credentials
            if (MPESA_CONFIG.consumerKey === 'test_consumer_key' || MPESA_CONFIG.consumerSecret === 'test_consumer_secret') {
                console.log('⚠️  Using test credentials - M-Pesa integration is in MOCK MODE');
                console.log('📝 To enable real M-Pesa payments:');
                console.log('   1. Complete your Safaricom developer app registration');
                console.log('   2. Get your real Consumer Key and Consumer Secret');
                console.log('   3. Update your .env file with real credentials');
                
                // Return a mock token for testing
                this.accessToken = 'mock_access_token_for_testing';
                this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
                return this.accessToken;
            }

            if (!MPESA_CONFIG.consumerKey || !MPESA_CONFIG.consumerSecret) {
                throw new Error('M-Pesa credentials not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in your .env file');
            }

            const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');
            
            const response = await axios.get(`${MPESA_CONFIG.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                }
            });

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            return this.accessToken;
        } catch (error) {
            console.error('M-Pesa Access Token Error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: {
                    consumerKey: MPESA_CONFIG.consumerKey ? 'SET' : 'NOT SET',
                    consumerSecret: MPESA_CONFIG.consumerSecret ? 'SET' : 'NOT SET'
                }
            });
            throw new Error(`Failed to get M-Pesa access token: ${error.message}`);
        }
    }

    // Check if token is valid
    isTokenValid() {
        return this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry;
    }

    // Generate timestamp
    getTimestamp() {
        return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    }

    // Generate password
    generatePassword() {
        const timestamp = this.getTimestamp();
        const password = Buffer.from(`${MPESA_CONFIG.businessShortCode}${MPESA_CONFIG.passkey}${timestamp}`).toString('base64');
        return { password, timestamp };
    }

    // STK Push (Lipa na M-Pesa Online)
    async initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc) {
        try {
            // Check if using test credentials (mock mode)
            if (MPESA_CONFIG.consumerKey === 'test_consumer_key' || MPESA_CONFIG.consumerSecret === 'test_consumer_secret') {
                console.log('🧪 MOCK MODE: Simulating M-Pesa STK Push');
                console.log(`📱 Phone: ${phoneNumber}, Amount: ${amount}, Reference: ${accountReference}`);
                
                // Return a mock successful response
                return {
                    success: true,
                    checkoutRequestID: 'mock_checkout_' + Date.now(),
                    merchantRequestID: 'mock_merchant_' + Date.now(),
                    responseCode: '0',
                    responseDescription: 'Success',
                    customerMessage: 'MOCK: You would receive an M-Pesa prompt on your phone. This is a test simulation.'
                };
            }

            // Ensure we have a valid access token
            if (!this.isTokenValid()) {
                await this.getAccessToken();
            }

            const { password, timestamp } = this.generatePassword();
            
            // Format phone number (remove + and ensure it starts with 254)
            let formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '254' + formattedPhone.substring(1);
            } else if (!formattedPhone.startsWith('254')) {
                formattedPhone = '254' + formattedPhone;
            }

            const requestBody = {
                BusinessShortCode: MPESA_CONFIG.businessShortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(amount), // Amount in KES
                PartyA: formattedPhone,
                PartyB: MPESA_CONFIG.businessShortCode,
                PhoneNumber: formattedPhone,
                CallBackURL: 'https://sandbox.safaricom.co.ke/mpesa/callback',
                AccountReference: accountReference,
                TransactionDesc: transactionDesc
            };

            console.log('STK Push Request:', requestBody);

            const response = await axios.post(
                `${MPESA_CONFIG.baseURL}/mpesa/stkpush/v1/processrequest`,
                requestBody,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                checkoutRequestID: response.data.CheckoutRequestID,
                merchantRequestID: response.data.MerchantRequestID,
                responseCode: response.data.ResponseCode,
                responseDescription: response.data.ResponseDescription,
                customerMessage: response.data.CustomerMessage
            };

        } catch (error) {
            console.error('STK Push Error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.errorMessage || error.message || 'Payment initiation failed'
            };
        }
    }

    // Query STK Push status
    async querySTKPush(checkoutRequestID) {
        try {
            // Check if using test credentials (mock mode)
            if (MPESA_CONFIG.consumerKey === 'test_consumer_key' || MPESA_CONFIG.consumerSecret === 'test_consumer_secret') {
                console.log('🧪 MOCK MODE: Simulating payment status check');
                
                // Simulate different payment outcomes for testing
                const mockResults = ['0', '1032', '1037']; // Success, Cancelled, Timeout
                const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];
                
                return {
                    success: true,
                    resultCode: randomResult,
                    resultDesc: randomResult === '0' ? 'Success' : 
                               randomResult === '1032' ? 'User cancelled' : 'Timeout',
                    merchantRequestID: 'mock_merchant_' + Date.now(),
                    checkoutRequestID: checkoutRequestID
                };
            }

            if (!this.isTokenValid()) {
                await this.getAccessToken();
            }

            const { password, timestamp } = this.generatePassword();

            const requestBody = {
                BusinessShortCode: MPESA_CONFIG.businessShortCode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            };

            console.log('STK Query Request:', requestBody);

            const response = await axios.post(
                `${MPESA_CONFIG.baseURL}/mpesa/stkpushquery/v1/query`,
                requestBody,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('STK Query Response:', response.data);

            return {
                success: true,
                resultCode: response.data.ResultCode,
                resultDesc: response.data.ResultDesc,
                merchantRequestID: response.data.MerchantRequestID,
                checkoutRequestID: response.data.CheckoutRequestID
            };

        } catch (error) {
            console.error('STK Query Error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            return {
                success: false,
                error: error.response?.data?.errorMessage || error.message || 'Query failed'
            };
        }
    }
}

module.exports = new MpesaService();
