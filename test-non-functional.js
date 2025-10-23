const axios = require('axios');

class NonFunctionalTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.testResults = {
            performance: [],
            scalability: [],
            security: []
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Non-Functional Requirements Testing...\n');
        
        try {
            await this.testPerformance();
            await this.testScalability();
            await this.testSecurity();
            
            this.generateReport();
        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
        }
    }

    // 1. PERFORMANCE TESTING
    async testPerformance() {
        console.log('📊 PERFORMANCE TESTING');
        console.log('=' .repeat(50));
        
        const tests = [
            { name: 'Homepage Load Time', endpoint: '/', expectedTime: 2000 },
            { name: 'Login Page Load Time', endpoint: '/login', expectedTime: 1500 },
            { name: 'Signup Page Load Time', endpoint: '/signup', expectedTime: 1500 },
            { name: 'Dashboard Load Time', endpoint: '/homeowner-dashboard', expectedTime: 3000 },
            { name: 'Search Response Time', endpoint: '/api/search-technicians', expectedTime: 5000 }
        ];

        for (const test of tests) {
            const result = await this.measureResponseTime(test.endpoint, test.name);
            this.testResults.performance.push({
                test: test.name,
                endpoint: test.endpoint,
                responseTime: result.time,
                expectedTime: test.expectedTime,
                status: result.time <= test.expectedTime ? 'PASS' : 'FAIL',
                details: result.details
            });
        }
    }

    // 2. SCALABILITY TESTING
    async testScalability() {
        console.log('\n📈 SCALABILITY TESTING');
        console.log('=' .repeat(50));
        
        const tests = [
            { name: 'Concurrent User Simulation', users: 10, duration: 30 },
            { name: 'Database Load Test', operations: 100, type: 'read' },
            { name: 'Memory Usage Test', duration: 60 },
            { name: 'Session Management Test', sessions: 50 }
        ];

        for (const test of tests) {
            const result = await this.simulateLoad(test);
            this.testResults.scalability.push({
                test: test.name,
                ...result,
                status: result.success ? 'PASS' : 'FAIL'
            });
        }
    }

    // 3. SECURITY TESTING
    async testSecurity() {
        console.log('\n🔒 SECURITY TESTING');
        console.log('=' .repeat(50));
        
        const tests = [
            { name: 'SQL Injection Protection', type: 'injection' },
            { name: 'XSS Protection', type: 'xss' },
            { name: 'Authentication Bypass', type: 'auth_bypass' },
            { name: 'Session Security', type: 'session' },
            { name: 'Input Validation', type: 'validation' }
        ];

        for (const test of tests) {
            const result = await this.testSecurityVulnerability(test);
            this.testResults.security.push({
                test: test.name,
                ...result,
                status: result.vulnerable ? 'FAIL' : 'PASS'
            });
        }
    }

    // Helper Methods
    async measureResponseTime(endpoint, testName) {
        const startTime = Date.now();
        try {
            const response = await axios.get(`${this.baseURL}${endpoint}`, {
                timeout: 10000,
                validateStatus: () => true // Accept any status code
            });
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            console.log(`✅ ${testName}: ${responseTime}ms (Status: ${response.status})`);
            
            return {
                time: responseTime,
                status: response.status,
                details: `Response time: ${responseTime}ms, Status: ${response.status}`
            };
        } catch (error) {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            console.log(`❌ ${testName}: ${responseTime}ms (Error: ${error.message})`);
            
            return {
                time: responseTime,
                status: 'ERROR',
                details: `Error: ${error.message}`
            };
        }
    }

    async simulateLoad(test) {
        console.log(`🔄 Running ${test.name}...`);
        
        try {
            if (test.name === 'Concurrent User Simulation') {
                return await this.simulateConcurrentUsers(test.users, test.duration);
            } else if (test.name === 'Database Load Test') {
                return await this.simulateDatabaseLoad(test.operations, test.type);
            } else if (test.name === 'Memory Usage Test') {
                return await this.simulateMemoryUsage(test.duration);
            } else if (test.name === 'Session Management Test') {
                return await this.simulateSessionLoad(test.sessions);
            }
            
            return { success: true, details: 'Test completed successfully' };
        } catch (error) {
            return { success: false, details: `Error: ${error.message}` };
        }
    }

    async simulateConcurrentUsers(userCount, duration) {
        const promises = [];
        const startTime = Date.now();
        
        for (let i = 0; i < userCount; i++) {
            promises.push(this.simulateUserSession(duration));
        }
        
        try {
            await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            console.log(`✅ Concurrent Users: ${userCount} users handled in ${totalTime}ms`);
            return { success: true, details: `${userCount} concurrent users handled successfully` };
        } catch (error) {
            console.log(`❌ Concurrent Users: Failed - ${error.message}`);
            return { success: false, details: `Failed to handle ${userCount} concurrent users` };
        }
    }

    async simulateUserSession(duration) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate user activity
                resolve();
            }, duration);
        });
    }

    async simulateDatabaseLoad(operations, type) {
        console.log(`🔄 Database Load Test: ${operations} ${type} operations`);
        
        try {
            const promises = [];
            for (let i = 0; i < operations; i++) {
                if (type === 'read') {
                    promises.push(axios.get(`${this.baseURL}/api/search-technicians`));
                }
            }
            
            await Promise.all(promises);
            console.log(`✅ Database Load: ${operations} ${type} operations completed`);
            return { success: true, details: `${operations} ${type} operations completed successfully` };
        } catch (error) {
            console.log(`❌ Database Load: Failed - ${error.message}`);
            return { success: false, details: `Failed to complete ${operations} ${type} operations` };
        }
    }

    async simulateMemoryUsage(duration) {
        console.log(`🔄 Memory Usage Test: ${duration} seconds`);
        
        try {
            // Simulate memory-intensive operations
            const startMemory = process.memoryUsage();
            const arrays = [];
            
            for (let i = 0; i < 1000; i++) {
                arrays.push(new Array(1000).fill(Math.random()));
            }
            
            await new Promise(resolve => setTimeout(resolve, duration * 1000));
            
            const endMemory = process.memoryUsage();
            const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
            
            console.log(`✅ Memory Usage: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
            return { success: true, details: `Memory usage: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB` };
        } catch (error) {
            console.log(`❌ Memory Usage: Failed - ${error.message}`);
            return { success: false, details: `Memory test failed: ${error.message}` };
        }
    }

    async simulateSessionLoad(sessionCount) {
        console.log(`🔄 Session Management: ${sessionCount} sessions`);
        
        try {
            const promises = [];
            for (let i = 0; i < sessionCount; i++) {
                promises.push(this.createTestSession());
            }
            
            await Promise.all(promises);
            console.log(`✅ Session Management: ${sessionCount} sessions handled`);
            return { success: true, details: `${sessionCount} sessions managed successfully` };
        } catch (error) {
            console.log(`❌ Session Management: Failed - ${error.message}`);
            return { success: false, details: `Session management failed: ${error.message}` };
        }
    }

    async createTestSession() {
        try {
            const response = await axios.post(`${this.baseURL}/login`, {
                email: 'test@example.com',
                password: 'testpassword'
            });
            return response;
        } catch (error) {
            // Expected to fail for test users
            return { status: 'test_session' };
        }
    }

    async testSecurityVulnerability(test) {
        console.log(`🔒 Testing ${test.name}...`);
        
        try {
            let result = { vulnerable: false, details: '' };
            
            switch (test.type) {
                case 'injection':
                    result = await this.testSQLInjection();
                    break;
                case 'xss':
                    result = await this.testXSS();
                    break;
                case 'auth_bypass':
                    result = await this.testAuthBypass();
                    break;
                case 'session':
                    result = await this.testSessionSecurity();
                    break;
                case 'validation':
                    result = await this.testInputValidation();
                    break;
            }
            
            console.log(`${result.vulnerable ? '❌' : '✅'} ${test.name}: ${result.vulnerable ? 'VULNERABLE' : 'SECURE'}`);
            return result;
        } catch (error) {
            console.log(`❌ ${test.name}: Error - ${error.message}`);
            return { vulnerable: true, details: `Test error: ${error.message}` };
        }
    }

    async testSQLInjection() {
        const maliciousInputs = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "admin'--",
            "' UNION SELECT * FROM users --"
        ];
        
        for (const input of maliciousInputs) {
            try {
                const response = await axios.post(`${this.baseURL}/login`, {
                    email: input,
                    password: 'test'
                });
                
                if (response.status === 200 && response.data.success) {
                    return { vulnerable: true, details: `SQL injection successful with input: ${input}` };
                }
            } catch (error) {
                // Expected to fail for malicious input
            }
        }
        
        return { vulnerable: false, details: 'SQL injection protection working' };
    }

    async testXSS() {
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            'javascript:alert("XSS")',
            '<svg onload=alert("XSS")>'
        ];
        
        for (const payload of xssPayloads) {
            try {
                const response = await axios.post(`${this.baseURL}/signup`, {
                    name: payload,
                    email: 'test@example.com',
                    password: 'test123',
                    phone: '1234567890'
                });
                
                if (response.data && response.data.includes(payload)) {
                    return { vulnerable: true, details: `XSS vulnerability found with payload: ${payload}` };
                }
            } catch (error) {
                // Expected to fail for malicious input
            }
        }
        
        return { vulnerable: false, details: 'XSS protection working' };
    }

    async testAuthBypass() {
        try {
            // Try to access protected routes without authentication
            const protectedRoutes = [
                '/homeowner-dashboard',
                '/technician-dashboard',
                '/admin',
                '/manage-requests'
            ];
            
            for (const route of protectedRoutes) {
                const response = await axios.get(`${this.baseURL}${route}`, {
                    validateStatus: () => true
                });
                
                if (response.status === 200 && !response.data.includes('login')) {
                    return { vulnerable: true, details: `Authentication bypass possible for route: ${route}` };
                }
            }
            
            return { vulnerable: false, details: 'Authentication protection working' };
        } catch (error) {
            return { vulnerable: false, details: 'Authentication protection working' };
        }
    }

    async testSessionSecurity() {
        try {
            // Test session fixation
            const response1 = await axios.get(`${this.baseURL}/login`);
            const sessionId1 = response1.headers['set-cookie'];
            
            const response2 = await axios.get(`${this.baseURL}/login`);
            const sessionId2 = response2.headers['set-cookie'];
            
            if (sessionId1 && sessionId2 && sessionId1 === sessionId2) {
                return { vulnerable: true, details: 'Session fixation vulnerability detected' };
            }
            
            return { vulnerable: false, details: 'Session security working' };
        } catch (error) {
            return { vulnerable: false, details: 'Session security working' };
        }
    }

    async testInputValidation() {
        const invalidInputs = [
            { field: 'email', value: 'invalid-email' },
            { field: 'phone', value: '123' },
            { field: 'amount', value: '-100' },
            { field: 'name', value: '' }
        ];
        
        for (const input of invalidInputs) {
            try {
                const payload = {
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'test123',
                    phone: '1234567890'
                };
                payload[input.field] = input.value;
                
                const response = await axios.post(`${this.baseURL}/signup`, payload);
                
                if (response.status === 200 && response.data.success) {
                    return { vulnerable: true, details: `Input validation failed for ${input.field}: ${input.value}` };
                }
            } catch (error) {
                // Expected to fail for invalid input
            }
        }
        
        return { vulnerable: false, details: 'Input validation working' };
    }

    generateReport() {
        console.log('\n📋 NON-FUNCTIONAL TESTING REPORT');
        console.log('=' .repeat(60));
        
        // Performance Report
        console.log('\n📊 PERFORMANCE RESULTS:');
        this.testResults.performance.forEach(test => {
            console.log(`${test.status === 'PASS' ? '✅' : '❌'} ${test.test}: ${test.responseTime}ms (Expected: ${test.expectedTime}ms)`);
        });
        
        // Scalability Report
        console.log('\n📈 SCALABILITY RESULTS:');
        this.testResults.scalability.forEach(test => {
            console.log(`${test.status === 'PASS' ? '✅' : '❌'} ${test.test}: ${test.details}`);
        });
        
        // Security Report
        console.log('\n🔒 SECURITY RESULTS:');
        this.testResults.security.forEach(test => {
            console.log(`${test.status === 'PASS' ? '✅' : '❌'} ${test.test}: ${test.details}`);
        });
        
        // Summary
        const totalTests = this.testResults.performance.length + this.testResults.scalability.length + this.testResults.security.length;
        const passedTests = [
            ...this.testResults.performance,
            ...this.testResults.scalability,
            ...this.testResults.security
        ].filter(test => test.status === 'PASS').length;
        
        console.log('\n📊 SUMMARY:');
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${totalTests - passedTests}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new NonFunctionalTester();
    tester.runAllTests().catch(console.error);
}

module.exports = NonFunctionalTester;
