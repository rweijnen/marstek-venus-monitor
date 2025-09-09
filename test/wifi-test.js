/**
 * Local test for WiFi Info parsing
 */

// Mock the window object for testing
global.window = {
    uiController: {
        log: console.log,
        getDeviceType: () => 'battery'
    }
};

// Import the modules (using compiled JS)
const { createPayload } = require('../js/dist/protocol/payloads/index.js');

// Test data from user's actual WiFi Info response
const wifiResponse = new Uint8Array([
    0x73, 0x10, 0x23, 0x08, // Header: start, length=16, identifier, command=0x08
    0x57, 0x69, 0x46, 0x69, 0x2d, 0x49, 0x6f, 0x54, 0x2d, 0x32, 0x34, // "WiFi-IoT-24"
    0x2d // checksum
]);

console.log('🧪 Testing WiFi Info parsing...');
console.log('📊 Input data:', Array.from(wifiResponse).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

try {
    const payload = createPayload(wifiResponse);
    const parsed = payload.parse();
    const html = payload.toHTML();
    
    console.log('✅ Parsing successful!');
    console.log('📋 Parsed data:', parsed);
    console.log('🎨 HTML output:');
    console.log(html);
    
} catch (error) {
    console.log('❌ Parsing failed:', error.message);
    console.log('📊 Stack trace:', error.stack);
}