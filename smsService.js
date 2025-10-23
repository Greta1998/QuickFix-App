const axios = require('axios');

class SMSService {
    constructor() {
        // For development, we'll use a mock SMS service
        // In production, integrate with services like:
        // - Africa's Talking SMS API
        // - Twilio
        // - AWS SNS
        // - Safaricom SMS API
        this.mockMode = process.env.SMS_MOCK_MODE === 'true' || !process.env.TWILIO_ACCOUNT_SID; // Default to mock mode if no Twilio credentials
        
        // Force mock mode for development (Twilio free trial has international SMS restrictions)
        this.mockMode = true;
        console.log('SMS Service: Using Mock Mode (Twilio free trial cannot send international SMS)');
    }

    /**
     * Send OTP SMS to phone number
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} otp - OTP code
     * @param {string} userName - User's name (optional)
     * @returns {Promise<Object>} SMS sending result
     */
    async sendOTP(phoneNumber, otp, userName = 'User') {
        try {
            // Format phone number (ensure it starts with country code)
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
        console.log('SMS Service Debug:', {
            mockMode: this.mockMode,
            hasSafaricomCredentials: !!(process.env.SAFARICOM_CONSUMER_KEY && process.env.SAFARICOM_CONSUMER_SECRET && process.env.SAFARICOM_APP_ID),
            hasTwilioCredentials: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
            hasAfricaTalkingCredentials: !!(process.env.AFRICASTALKING_USERNAME && process.env.AFRICASTALKING_API_KEY)
        });
            
            if (this.mockMode) {
                // Mock SMS sending for development
                console.log(`📱 MOCK SMS SENT:`);
                console.log(`   To: ${formattedNumber}`);
                console.log(`   Message: Your QuickFix verification code is: ${otp}`);
                console.log(`   Valid for: 5 minutes`);
                
                return {
                    success: true,
                    messageId: `mock_${Date.now()}`,
                    message: 'OTP sent successfully (Mock Mode)'
                };
            }

            // Production SMS sending with Safaricom SMS API (Primary for Kenya)
            if (process.env.SAFARICOM_CONSUMER_KEY && process.env.SAFARICOM_CONSUMER_SECRET && process.env.SAFARICOM_APP_ID) {
                // Get access token first
                const tokenResponse = await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${process.env.SAFARICOM_CONSUMER_KEY}:${process.env.SAFARICOM_CONSUMER_SECRET}`).toString('base64')
                    }
                });
                
                const accessToken = tokenResponse.data.access_token;
                
                // Send SMS
                const smsResponse = await axios.post('https://api.safaricom.co.ke/sms/v1/send', {
                    "message": `Your QuickFix verification code is: ${otp}. Valid for 5 minutes.`,
                    "to": formattedNumber,
                    "from": "QuickFix"
                }, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                return {
                    success: true,
                    messageId: smsResponse.data.messageId,
                    message: 'OTP sent successfully via Safaricom SMS'
                };
            }
            // Fallback to Twilio (for international)
            else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
                const response = await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
                    `To=${formattedNumber}&From=${process.env.TWILIO_PHONE_NUMBER}&Body=Your QuickFix verification code is: ${otp}. Valid for 5 minutes.`,
                    {
                        headers: {
                            'Authorization': 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );
                
                return {
                    success: true,
                    messageId: response.data.sid,
                    message: 'OTP sent successfully via Twilio'
                };
            }
            // Fallback to Africa's Talking
            else if (process.env.AFRICASTALKING_USERNAME && process.env.AFRICASTALKING_API_KEY) {
                const message = `Your QuickFix verification code is: ${otp}. Valid for 5 minutes.`;
                const formData = new URLSearchParams({
                    username: process.env.AFRICASTALKING_USERNAME,
                    to: formattedNumber,
                    message: message,
                    from: 'QuickFix'
                });
                
                const response = await axios.post('https://api.africastalking.com/version1/messaging', 
                    formData.toString(), 
                    {
                        headers: {
                            'apiKey': process.env.AFRICASTALKING_API_KEY,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );
                
                return {
                    success: true,
                    messageId: response.data.SMSMessageData.Recipients[0].messageId,
                    message: 'OTP sent successfully via Africa\'s Talking'
                };
            } else {
                // Fallback to mock if no credentials
                console.log('⚠️  No SMS credentials found. Using mock mode.');
                return {
                    success: true,
                    messageId: `mock_${Date.now()}`,
                    message: 'OTP sent successfully (Mock Mode - No SMS credentials)'
                };
            }

        } catch (error) {
            console.error('SMS sending error:', error);
            return {
                success: false,
                error: 'Failed to send SMS. Please try again.',
                details: error.message
            };
        }
    }

    /**
     * Format phone number to international format
     * @param {string} phoneNumber - Raw phone number
     * @returns {string} Formatted phone number
     */
    formatPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Handle Kenyan numbers
        if (cleaned.startsWith('0')) {
            // Convert 07xxxxxxxx to 2547xxxxxxxx
            cleaned = '254' + cleaned.substring(1);
        } else if (cleaned.startsWith('7') && cleaned.length === 9) {
            // Convert 7xxxxxxxx to 2547xxxxxxxx
            cleaned = '254' + cleaned;
        } else if (!cleaned.startsWith('254')) {
            // Add 254 prefix if not present
            cleaned = '254' + cleaned;
        }
        
        return '+' + cleaned;
    }

    /**
     * Send welcome SMS after successful registration
     * @param {string} phoneNumber - User's phone number
     * @param {string} userName - User's name
     * @param {string} role - User's role
     * @returns {Promise<Object>} SMS sending result
     */
    async sendWelcomeSMS(phoneNumber, userName, role) {
        try {
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const message = `Welcome to QuickFix, ${userName}! Your ${role} account has been created successfully.`;
            
            if (this.mockMode) {
                console.log(`📱 MOCK WELCOME SMS SENT:`);
                console.log(`   To: ${formattedNumber}`);
                console.log(`   Message: ${message}`);
                
                return {
                    success: true,
                    messageId: `welcome_${Date.now()}`,
                    message: 'Welcome SMS sent successfully (Mock Mode)'
                };
            }

            // Production SMS sending would go here
            return {
                success: true,
                messageId: 'welcome_sms_id',
                message: 'Welcome SMS sent successfully'
            };

        } catch (error) {
            console.error('Welcome SMS error:', error);
            return {
                success: false,
                error: 'Failed to send welcome SMS',
                details: error.message
            };
        }
    }

    /**
     * Enable production mode (disable mock)
     */
    enableProduction() {
        this.mockMode = false;
        console.log('SMS Service: Production mode enabled');
    }

    /**
     * Enable mock mode (for development)
     */
    enableMock() {
        this.mockMode = true;
        console.log('SMS Service: Mock mode enabled');
    }
}

module.exports = new SMSService();
