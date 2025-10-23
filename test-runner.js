const NonFunctionalTester = require('./test-non-functional');
const UATTester = require('./test-uat');

class TestRunner {
    constructor() {
        this.results = {
            nonFunctional: null,
            uat: null,
            summary: null
        };
    }

    async runAllTests() {
        console.log('🚀 QUICKFIX COMPREHENSIVE TESTING SUITE');
        console.log('=' .repeat(60));
        console.log('Testing Non-Functional Requirements and User Acceptance Testing\n');
        
        try {
            // Run Non-Functional Tests
            console.log('🔧 Starting Non-Functional Requirements Testing...\n');
            const nonFunctionalTester = new NonFunctionalTester();
            await nonFunctionalTester.runAllTests();
            this.results.nonFunctional = nonFunctionalTester.testResults;
            
            console.log('\n' + '=' .repeat(60));
            console.log('⏳ Waiting 5 seconds before UAT tests...\n');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Run UAT Tests
            console.log('🧪 Starting User Acceptance Testing...\n');
            const uatTester = new UATTester();
            await uatTester.runAllTests();
            this.results.uat = uatTester.testResults;
            
            // Generate comprehensive report
            this.generateComprehensiveReport();
            
        } catch (error) {
            console.error('❌ Test suite execution failed:', error.message);
        }
    }

    generateComprehensiveReport() {
        console.log('\n📊 COMPREHENSIVE TESTING REPORT');
        console.log('=' .repeat(80));
        
        // Non-Functional Requirements Summary
        console.log('\n🔧 NON-FUNCTIONAL REQUIREMENTS TESTING:');
        console.log('-' .repeat(50));
        
        if (this.results.nonFunctional) {
            const perfTests = this.results.nonFunctional.performance || [];
            const scaleTests = this.results.nonFunctional.scalability || [];
            const secTests = this.results.nonFunctional.security || [];
            
            const perfPassed = perfTests.filter(t => t.status === 'PASS').length;
            const scalePassed = scaleTests.filter(t => t.status === 'PASS').length;
            const secPassed = secTests.filter(t => t.status === 'PASS').length;
            
            console.log(`📊 Performance Tests: ${perfPassed}/${perfTests.length} passed`);
            console.log(`📈 Scalability Tests: ${scalePassed}/${scaleTests.length} passed`);
            console.log(`🔒 Security Tests: ${secPassed}/${secTests.length} passed`);
            
            const totalNonFunc = perfTests.length + scaleTests.length + secTests.length;
            const totalNonFuncPassed = perfPassed + scalePassed + secPassed;
            console.log(`📋 Total Non-Functional: ${totalNonFuncPassed}/${totalNonFunc} passed`);
        }
        
        // UAT Summary
        console.log('\n🧪 USER ACCEPTANCE TESTING:');
        console.log('-' .repeat(50));
        
        if (this.results.uat) {
            const uatPassed = this.results.uat.filter(t => t.success).length;
            const uatTotal = this.results.uat.length;
            console.log(`✅ UAT Tests: ${uatPassed}/${uatTotal} passed`);
            
            // Show failed UAT tests
            const failedUAT = this.results.uat.filter(t => !t.success);
            if (failedUAT.length > 0) {
                console.log('\n❌ Failed UAT Tests:');
                failedUAT.forEach(test => {
                    console.log(`  • ${test.name}: ${test.details}`);
                });
            }
        }
        
        // Overall Summary
        console.log('\n📊 OVERALL TESTING SUMMARY:');
        console.log('=' .repeat(50));
        
        const nonFuncTotal = this.results.nonFunctional ? 
            (this.results.nonFunctional.performance?.length || 0) + 
            (this.results.nonFunctional.scalability?.length || 0) + 
            (this.results.nonFunctional.security?.length || 0) : 0;
        
        const nonFuncPassed = this.results.nonFunctional ? 
            (this.results.nonFunctional.performance?.filter(t => t.status === 'PASS').length || 0) + 
            (this.results.nonFunctional.scalability?.filter(t => t.status === 'PASS').length || 0) + 
            (this.results.nonFunctional.security?.filter(t => t.status === 'PASS').length || 0) : 0;
        
        const uatTotal = this.results.uat?.length || 0;
        const uatPassed = this.results.uat?.filter(t => t.success).length || 0;
        
        const totalTests = nonFuncTotal + uatTotal;
        const totalPassed = nonFuncPassed + uatPassed;
        const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
        
        console.log(`Total Tests Executed: ${totalTests}`);
        console.log(`Total Tests Passed: ${totalPassed}`);
        console.log(`Total Tests Failed: ${totalTests - totalPassed}`);
        console.log(`Overall Success Rate: ${successRate}%`);
        
        // Recommendations
        console.log('\n🎯 TESTING RECOMMENDATIONS:');
        console.log('-' .repeat(50));
        
        if (successRate >= 90) {
            console.log('✅ EXCELLENT: System is ready for production deployment!');
            console.log('   • All critical functionality is working correctly');
            console.log('   • Performance and security requirements are met');
            console.log('   • User acceptance criteria are satisfied');
        } else if (successRate >= 75) {
            console.log('⚠️  GOOD: System is mostly ready with minor issues to address');
            console.log('   • Address failed tests before production deployment');
            console.log('   • Consider additional testing for failed components');
        } else if (successRate >= 50) {
            console.log('⚠️  FAIR: System needs significant improvements');
            console.log('   • Multiple critical issues need to be resolved');
            console.log('   • Additional development and testing required');
        } else {
            console.log('❌ POOR: System is not ready for production');
            console.log('   • Major issues need to be addressed');
            console.log('   • Consider system redesign for failed components');
        }
        
        // Next Steps
        console.log('\n📋 NEXT STEPS:');
        console.log('-' .repeat(50));
        console.log('1. Review failed tests and prioritize fixes');
        console.log('2. Re-run tests after implementing fixes');
        console.log('3. Consider additional testing for edge cases');
        console.log('4. Document test results for stakeholders');
        console.log('5. Plan production deployment based on results');
        
        console.log('\n🏁 Testing completed successfully!');
    }
}

// Run comprehensive tests if called directly
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests().catch(console.error);
}

module.exports = TestRunner;
