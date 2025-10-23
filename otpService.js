const crypto = require('crypto');

class OTPService {
    constructor() {
        this.otpStore = new Map(); // In production, use Redis or database
        this.otpExpiry = 5 * 60 * 1000; // 5 minutes in milliseconds
    }

    /**
     * Generate a 6-digit OTP
     * @returns {string} 6-digit OTP
     */
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Store OTP for a phone number
     * @param {string} phoneNumber - User's phone number
     * @param {string} otp - Generated OTP
     * @returns {Object} OTP details
     */
    storeOTP(phoneNumber, otp) {
        const otpData = {
            otp: otp,
            phoneNumber: phoneNumber,
            createdAt: Date.now(),
            attempts: 0,
            verified: false
        };

        this.otpStore.set(phoneNumber, otpData);
        
        // Auto-cleanup after expiry
        setTimeout(() => {
            this.otpStore.delete(phoneNumber);
        }, this.otpExpiry);

        return otpData;
    }

    /**
     * Verify OTP for a phone number
     * @param {string} phoneNumber - User's phone number
     * @param {string} inputOTP - OTP entered by user
     * @returns {Object} Verification result
     */
    verifyOTP(phoneNumber, inputOTP) {
        const otpData = this.otpStore.get(phoneNumber);
        
        if (!otpData) {
            return {
                success: false,
                message: 'OTP not found or expired. Please request a new OTP.',
                attempts: 0
            };
        }

        // Check if OTP has expired
        if (Date.now() - otpData.createdAt > this.otpExpiry) {
            this.otpStore.delete(phoneNumber);
            return {
                success: false,
                message: 'OTP has expired. Please request a new OTP.',
                attempts: otpData.attempts
            };
        }

        // Check attempt limit (max 3 attempts)
        if (otpData.attempts >= 3) {
            this.otpStore.delete(phoneNumber);
            return {
                success: false,
                message: 'Too many failed attempts. Please request a new OTP.',
                attempts: otpData.attempts
            };
        }

        // Verify OTP
        if (otpData.otp === inputOTP) {
            otpData.verified = true;
            this.otpStore.set(phoneNumber, otpData);
            return {
                success: true,
                message: 'OTP verified successfully!',
                attempts: otpData.attempts
            };
        } else {
            // Increment attempt count
            otpData.attempts++;
            this.otpStore.set(phoneNumber, otpData);
            
            return {
                success: false,
                message: `Invalid OTP. ${3 - otpData.attempts} attempts remaining.`,
                attempts: otpData.attempts
            };
        }
    }

    /**
     * Check if OTP is verified for a phone number
     * @param {string} phoneNumber - User's phone number
     * @returns {boolean} True if verified
     */
    isOTPVerified(phoneNumber) {
        const otpData = this.otpStore.get(phoneNumber);
        return otpData ? otpData.verified : false;
    }

    /**
     * Clean up verified OTP
     * @param {string} phoneNumber - User's phone number
     */
    cleanupOTP(phoneNumber) {
        this.otpStore.delete(phoneNumber);
    }

    /**
     * Get OTP status for a phone number
     * @param {string} phoneNumber - User's phone number
     * @returns {Object} OTP status
     */
    getOTPStatus(phoneNumber) {
        const otpData = this.otpStore.get(phoneNumber);
        
        if (!otpData) {
            return {
                exists: false,
                verified: false,
                attempts: 0,
                timeRemaining: 0
            };
        }

        const timeRemaining = Math.max(0, this.otpExpiry - (Date.now() - otpData.createdAt));
        
        return {
            exists: true,
            verified: otpData.verified,
            attempts: otpData.attempts,
            timeRemaining: timeRemaining
        };
    }
}

module.exports = new OTPService();
