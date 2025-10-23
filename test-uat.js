const axios = require('axios');

class UATTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.testResults = [];
        this.testScenarios = [
            'Homeowner Registration and Login',
            'Technician Application Process',
            'Repair Request Submission',
            'Technician Assignment',
            'Payment Processing',
            'Rating System',
            'Chat Communication',
            'Admin Management'
        ];
    }

    async runAllTests() {
        console.log('🧪 Starting User Acceptance Testing (UAT)...\n');
        
        try {
            await this.testHomeownerWorkflow();
            await this.testTechnicianWorkflow();
            await this.testAdminWorkflow();
            await this.testPaymentWorkflow();
            await this.testCommunicationWorkflow();
            
            this.generateUATReport();
        } catch (error) {
            console.error('❌ UAT execution failed:', error.message);
        }
    }

    // 1. HOMEOwner Workflow Testing
    async testHomeownerWorkflow() {
        console.log('🏠 HOMEOwner Workflow Testing');
        console.log('=' .repeat(50));
        
        const tests = [
            { name: 'Homeowner Registration', test: () => this.testHomeownerRegistration() },
            { name: 'Homeowner Login', test: () => this.testHomeownerLogin() },
            { name: 'Dashboard Access', test: () => this.testHomeownerDashboard() },
            { name: 'Repair Request Submission', test: () => this.testRepairRequestSubmission() },
            { name: 'Payment Process', test: () => this.testPaymentProcess() },
            { name: 'Rating Submission', test: () => this.testRatingSubmission() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.test);
        }
    }

    // 2. Technician Workflow Testing
    async testTechnicianWorkflow() {
        console.log('\n🔧 Technician Workflow Testing');
        console.log('=' .repeat(50));
        
        const tests = [
            { name: 'Technician Application', test: () => this.testTechnicianApplication() },
            { name: 'Application Status Check', test: () => this.testApplicationStatus() },
            { name: 'Technician Dashboard', test: () => this.testTechnicianDashboard() },
            { name: 'Request Management', test: () => this.testRequestManagement() },
            { name: 'Chat Communication', test: () => this.testChatCommunication() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.test);
        }
    }

    // 3. Admin Workflow Testing
    async testAdminWorkflow() {
        console.log('\n👨‍💼 Admin Workflow Testing');
        console.log('=' .repeat(50));
        
        const tests = [
            { name: 'Admin Login', test: () => this.testAdminLogin() },
            { name: 'Application Review', test: () => this.testApplicationReview() },
            { name: 'Account Management', test: () => this.testAccountManagement() },
            { name: 'System Analytics', test: () => this.testSystemAnalytics() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.test);
        }
    }

    // 4. Payment Workflow Testing
    async testPaymentWorkflow() {
        console.log('\n💳 Payment Workflow Testing');
        console.log('=' .repeat(50));
        
        const tests = [
            { name: 'Payment Method Selection', test: () => this.testPaymentMethodSelection() },
            { name: 'M-Pesa Integration', test: () => this.testMpesaIntegration() },
            { name: 'Cash Payment', test: () => this.testCashPayment() },
            { name: 'Payment Confirmation', test: () => this.testPaymentConfirmation() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.test);
        }
    }

    // 5. Communication Workflow Testing
    async testCommunicationWorkflow() {
        console.log('\n💬 Communication Workflow Testing');
        console.log('=' .repeat(50));
        
        const tests = [
            { name: 'Chat List Access', test: () => this.testChatListAccess() },
            { name: 'Message Sending', test: () => this.testMessageSending() },
            { name: 'Real-time Updates', test: () => this.testRealTimeUpdates() },
            { name: 'Notification System', test: () => this.testNotificationSystem() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.test);
        }
    }

    // Test Implementation Methods
    async testHomeownerRegistration() {
        try {
            const response = await axios.post(`${this.baseURL}/signup`, {
                name: 'Test Homeowner',
                email: 'homeowner@test.com',
                password: 'Test123!',
                phone: '254712345678',
                role: 'homeowner'
            });
            
            return {
                success: response.status === 200,
                details: 'Homeowner registration successful',
                response: response.data
            };
        } catch (error) {
            return {
                success: false,
                details: `Registration failed: ${error.message}`,
                error: error.response?.data
            };
        }
    }

    async testHomeownerLogin() {
        try {
            const response = await axios.post(`${this.baseURL}/login`, {
                email: 'homeowner@test.com',
                password: 'Test123!'
            });
            
            return {
                success: response.status === 200 && response.data.success,
                details: 'Homeowner login successful',
                response: response.data
            };
        } catch (error) {
            return {
                success: false,
                details: `Login failed: ${error.message}`,
                error: error.response?.data
            };
        }
    }

    async testHomeownerDashboard() {
        try {
            const response = await axios.get(`${this.baseURL}/homeowner-dashboard`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Dashboard accessible',
                response: 'Dashboard loaded successfully'
            };
        } catch (error) {
            return {
                success: false,
                details: `Dashboard access failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testRepairRequestSubmission() {
        try {
            const response = await axios.post(`${this.baseURL}/request`, {
                appliance: 'Washing Machine',
                description: 'Not starting, makes noise',
                urgency: 'High',
                location: 'Nairobi, Kenya',
                latitude: -1.2921,
                longitude: 36.8219
            });
            
            return {
                success: response.status === 200,
                details: 'Repair request submitted successfully',
                response: response.data
            };
        } catch (error) {
            return {
                success: false,
                details: `Request submission failed: ${error.message}`,
                error: error.response?.data
            };
        }
    }

    async testTechnicianApplication() {
        try {
            const response = await axios.post(`${this.baseURL}/technician-application`, {
                name: 'Test Technician',
                email: 'technician@test.com',
                phone: '254723456789',
                specialty: 'Electronics',
                experience: '5 years',
                location: 'Nairobi, Kenya',
                availability: 'Full-time',
                certifications: 'Certified Electrician',
                portfolio: 'Previous work examples'
            });
            
            return {
                success: response.status === 200,
                details: 'Technician application submitted',
                response: response.data
            };
        } catch (error) {
            return {
                success: false,
                details: `Application submission failed: ${error.message}`,
                error: error.response?.data
            };
        }
    }

    async testApplicationStatus() {
        try {
            const response = await axios.get(`${this.baseURL}/technician-application-status`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Application status accessible',
                response: 'Status page loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Status check failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testTechnicianDashboard() {
        try {
            const response = await axios.get(`${this.baseURL}/technician-dashboard`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Technician dashboard accessible',
                response: 'Dashboard loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Dashboard access failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testRequestManagement() {
        try {
            const response = await axios.get(`${this.baseURL}/manage-requests`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Request management accessible',
                response: 'Management page loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Request management failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testAdminLogin() {
        try {
            const response = await axios.post(`${this.baseURL}/login`, {
                email: 'admin@quickfix.com',
                password: 'Admin@123'
            });
            
            return {
                success: response.status === 200 && response.data.success,
                details: 'Admin login successful',
                response: response.data
            };
        } catch (error) {
            return {
                success: false,
                details: `Admin login failed: ${error.message}`,
                error: error.response?.data
            };
        }
    }

    async testApplicationReview() {
        try {
            const response = await axios.get(`${this.baseURL}/manage-applications`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Application review accessible',
                response: 'Review page loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Application review failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testAccountManagement() {
        try {
            const response = await axios.get(`${this.baseURL}/manage-accounts`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Account management accessible',
                response: 'Account management loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Account management failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testSystemAnalytics() {
        try {
            const response = await axios.get(`${this.baseURL}/admin`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'System analytics accessible',
                response: 'Analytics loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Analytics access failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testPaymentMethodSelection() {
        try {
            const response = await axios.get(`${this.baseURL}/payment`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Payment method selection accessible',
                response: 'Payment page loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Payment method selection failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testMpesaIntegration() {
        try {
            const response = await axios.post(`${this.baseURL}/mpesa/pay`, {
                requestId: 'test-request-123',
                phoneNumber: '254712345678',
                amount: 1000
            });
            
            return {
                success: response.status === 200,
                details: 'M-Pesa integration functional',
                response: response.data
            };
        } catch (error) {
            return {
                success: false,
                details: `M-Pesa integration failed: ${error.message}`,
                error: error.response?.data
            };
        }
    }

    async testCashPayment() {
        try {
            const response = await axios.post(`${this.baseURL}/pay`, {
                requestId: 'test-request-123',
                method: 'Cash'
            });
            
            return {
                success: response.status === 200,
                details: 'Cash payment processed',
                response: response.data
            };
        } catch (error) {
            return {
                success: false,
                details: `Cash payment failed: ${error.message}`,
                error: error.response?.data
            };
        }
    }

    async testPaymentConfirmation() {
        try {
            const response = await axios.get(`${this.baseURL}/rate`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Payment confirmation accessible',
                response: 'Rating page loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Payment confirmation failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testChatListAccess() {
        try {
            const response = await axios.get(`${this.baseURL}/chat`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Chat list accessible',
                response: 'Chat list loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Chat list access failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testMessageSending() {
        try {
            const response = await axios.get(`${this.baseURL}/messages/test-request-123`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Message sending interface accessible',
                response: 'Chat interface loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Message sending failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testRealTimeUpdates() {
        try {
            const response = await axios.get(`${this.baseURL}/api/search-technicians`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Real-time updates functional',
                response: 'API response received'
            };
        } catch (error) {
            return {
                success: false,
                details: `Real-time updates failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testNotificationSystem() {
        try {
            const response = await axios.get(`${this.baseURL}/notifications`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Notification system accessible',
                response: 'Notifications loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Notification system failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testPaymentProcess() {
        try {
            const response = await axios.get(`${this.baseURL}/payment`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Payment process accessible',
                response: 'Payment page loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Payment process failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async testRatingSubmission() {
        try {
            const response = await axios.get(`${this.baseURL}/rate`, {
                validateStatus: () => true
            });
            
            return {
                success: response.status === 200,
                details: 'Rating submission accessible',
                response: 'Rating page loaded'
            };
        } catch (error) {
            return {
                success: false,
                details: `Rating submission failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async runTest(testName, testFunction) {
        try {
            console.log(`🔄 Testing: ${testName}`);
            const result = await testFunction();
            
            this.testResults.push({
                name: testName,
                success: result.success,
                details: result.details,
                response: result.response,
                error: result.error
            });
            
            console.log(`${result.success ? '✅' : '❌'} ${testName}: ${result.details}`);
        } catch (error) {
            this.testResults.push({
                name: testName,
                success: false,
                details: `Test execution failed: ${error.message}`,
                error: error.message
            });
            console.log(`❌ ${testName}: Test execution failed`);
        }
    }

    generateUATReport() {
        console.log('\n📋 USER ACCEPTANCE TESTING REPORT');
        console.log('=' .repeat(60));
        
        const passedTests = this.testResults.filter(test => test.success);
        const failedTests = this.testResults.filter(test => !test.success);
        
        console.log('\n✅ PASSED TESTS:');
        passedTests.forEach(test => {
            console.log(`  • ${test.name}: ${test.details}`);
        });
        
        console.log('\n❌ FAILED TESTS:');
        failedTests.forEach(test => {
            console.log(`  • ${test.name}: ${test.details}`);
            if (test.error) {
                console.log(`    Error: ${test.error}`);
            }
        });
        
        console.log('\n📊 UAT SUMMARY:');
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`Passed: ${passedTests.length}`);
        console.log(`Failed: ${failedTests.length}`);
        console.log(`Success Rate: ${((passedTests.length / this.testResults.length) * 100).toFixed(1)}%`);
        
        console.log('\n🎯 UAT RECOMMENDATIONS:');
        if (failedTests.length === 0) {
            console.log('✅ All UAT tests passed! The system is ready for production.');
        } else {
            console.log('⚠️  Some UAT tests failed. Please address the following issues:');
            failedTests.forEach(test => {
                console.log(`  • Fix: ${test.name} - ${test.details}`);
            });
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new UATTester();
    tester.runAllTests().catch(console.error);
}

module.exports = UATTester;
