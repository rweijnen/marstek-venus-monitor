/**
 * Integration Test for Modular Architecture
 * 
 * This script verifies that all modules are properly connected
 * and can communicate with each other.
 */

function runIntegrationTest() {
    console.log('🧪 Running Integration Test...');
    
    const tests = [];
    
    // Test 1: UI Controller availability
    tests.push({
        name: 'UI Controller Module',
        test: () => {
            return typeof window.uiController === 'object' &&
                   typeof window.uiController.log === 'function' &&
                   typeof window.uiController.displayData === 'function' &&
                   typeof window.uiController.updateStatus === 'function';
        }
    });
    
    // Test 2: Data Parser availability
    tests.push({
        name: 'Data Parser Module',
        test: () => {
            return typeof window.dataParser === 'object' &&
                   typeof window.dataParser.parseResponse === 'function';
        }
    });
    
    // Test 3: BLE Protocol availability
    tests.push({
        name: 'BLE Protocol Module',
        test: () => {
            return typeof window.connect === 'function' &&
                   typeof window.disconnect === 'function' &&
                   typeof window.sendCommand === 'function' &&
                   typeof window.sendConfigWriteCommand === 'function';
        }
    });
    
    // Test 4: Command buttons functionality
    tests.push({
        name: 'Command Buttons',
        test: () => {
            const buttons = document.querySelectorAll('button[onclick*="sendCommand"]');
            return buttons.length > 10; // Should have many command buttons
        }
    });
    
    // Test 5: Data parser integration
    tests.push({
        name: 'Data Parser Integration',
        test: () => {
            try {
                // Wait a moment for modules to be fully loaded
                if (!window.dataParser) {
                    console.log('Data parser not yet available');
                    return false;
                }
                
                // Test parsing a simple response (corrected length: 9 bytes total, checksum: 0x4b)
                const testData = new Uint8Array([0x73, 0x09, 0x23, 0x04, 0x74, 0x65, 0x73, 0x74, 0x4b]);
                const result = window.dataParser.parseResponse(testData, 'Test Command');
                return typeof result === 'string' && result.length > 0;
            } catch (error) {
                console.error('Data parser test failed:', error);
                return false;
            }
        }
    });
    
    // Run all tests
    let passed = 0;
    let failed = 0;
    
    tests.forEach(test => {
        try {
            if (test.test()) {
                console.log(`✅ ${test.name}: PASSED`);
                passed++;
            } else {
                console.log(`❌ ${test.name}: FAILED`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${test.name}: ERROR - ${error.message}`);
            failed++;
        }
    });
    
    console.log(`\n🧪 Integration Test Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${Math.round(passed / (passed + failed) * 100)}%`);
    
    if (failed === 0) {
        console.log('🎉 All integration tests passed! The modular architecture is working correctly.');
        
        // Test the new configuration commands
        console.log('\n🔧 Testing new configuration commands...');
        const readConfigBtn = document.querySelector('button[onclick*="0x10"]');
        const writeConfigBtn = document.querySelector('button[onclick*="sendConfigWriteCommand"]');
        
        if (readConfigBtn && writeConfigBtn) {
            console.log('✅ Configuration commands (0x10 and 0x80) are properly integrated');
        } else {
            console.log('❌ Configuration commands are missing from UI');
        }
    } else {
        console.log('⚠️ Some integration tests failed. Please check the console for details.');
    }
    
    return failed === 0;
}

// Integration tests disabled - only run manually if needed
// Auto-run removed to prevent interference with connection state

// Make test available globally for manual execution
if (typeof window !== 'undefined') {
    window.runIntegrationTest = runIntegrationTest;
}