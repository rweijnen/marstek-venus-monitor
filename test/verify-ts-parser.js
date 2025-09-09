// Test the compiled TypeScript parser with your latest runtime data

// Import the compiled TypeScript parser
import { parseResponse } from '../js/dist/data-parser-ts.js';

// Your latest runtime data from [8:46:37 PM]
const hexData = [
    0x73, 0x6d, 0x23, 0x03, 0x00, 0x00, 0x1e, 0x01, 0x03, 0x01, 0x01, 0x01, 
    0x03, 0xbd, 0x01, 0x57, 0x99, 0x00, 0xff, 0x00, 0x00, 0x00, 0x7c, 0x73, 
    0x00, 0x00, 0x78, 0x00, 0x00, 0x00, 0x8f, 0x08, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0x8e, 0x00, 
    0x00, 0xf0, 0x69, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc4, 0x09, 0x03, 0x02, 0x01, 0xd7, 
    0x00, 0x32, 0x30, 0x32, 0x34, 0x30, 0x39, 0x30, 0x39, 0x30, 0x31, 0x35, 
    0x39, 0x00, 0x00, 0x01, 0x00, 0xff, 0x03, 0xf2, 0x64, 0x01, 0x30, 0x75, 
    0x3e
];

const data = new Uint8Array(hexData);

console.log('Testing Compiled TypeScript Parser');
console.log('==================================');
console.log(`Data length: ${data.length} bytes`);
console.log(`Command: 0x${data[3].toString(16).padStart(2, '0').toUpperCase()}`);
console.log('');

// Mock the window object for the TypeScript parser
global.window = {
    uiController: {
        log: (msg) => console.log(`[DEBUG] ${msg}`)
    }
};

try {
    // Parse using the compiled TypeScript parser
    console.log('Calling TypeScript parseResponse...');
    const htmlOutput = parseResponse(data, 'Runtime Info');
    
    console.log('HTML Output:');
    console.log('============');
    console.log(htmlOutput);
    
    // Extract key values from HTML for verification
    console.log('\nExtracting Values for Verification:');
    console.log('====================================');
    
    const gridPowerMatch = htmlOutput.match(/<strong>Grid Power:<\/strong>\s*([^<]+)/);
    const powerRatingMatch = htmlOutput.match(/<strong>Power Rating:<\/strong>\s*([^<]+)/);
    const firmwareMatch = htmlOutput.match(/<strong>Firmware Version:<\/strong>\s*([^<]+)/);
    const buildCodeMatch = htmlOutput.match(/<strong>Build Code:<\/strong>\s*([^<]+)/);
    const apiPortMatch = htmlOutput.match(/<strong>API Port:<\/strong>\s*([^<]+)/);
    
    console.log(`Grid Power: ${gridPowerMatch ? gridPowerMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`Power Rating: ${powerRatingMatch ? powerRatingMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`Firmware Version: ${firmwareMatch ? firmwareMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`Build Code: ${buildCodeMatch ? buildCodeMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`API Port: ${apiPortMatch ? apiPortMatch[1].trim() : 'NOT FOUND'}`);
    
    console.log('\nValidation:');
    console.log('-----------');
    
    const powerRating = powerRatingMatch ? powerRatingMatch[1].trim() : '';
    const firmwareVersion = firmwareMatch ? firmwareMatch[1].trim() : '';
    const apiPort = apiPortMatch ? apiPortMatch[1].trim() : '';
    
    console.log(`Power Rating: ${powerRating.includes('2500W') ? '✅' : '❌'} ${powerRating} (expected: 2500W)`);
    console.log(`Firmware Version: ${firmwareVersion === 'v3.2' ? '✅' : '❌'} ${firmwareVersion} (expected: v3.2)`);
    console.log(`API Port: ${apiPort === '30000' ? '✅' : '❌'} ${apiPort} (expected: 30000)`);
    
} catch (error) {
    console.error('Error testing TypeScript parser:', error);
    console.error('Stack:', error.stack);
}

// Also do a direct payload analysis for comparison
console.log('\n\nDirect Payload Analysis (for comparison):');
console.log('==========================================');

const payload = data.slice(4, -1);
console.log(`Payload length: ${payload.length} bytes`);

// Helper functions
function readUint16LE(arr, offset) {
    return ((arr[offset + 1] << 8) | arr[offset]) >>> 0;
}

function readInt16LE(arr, offset) {
    const val = (arr[offset + 1] << 8) | arr[offset];
    return val > 0x7FFF ? val - 0x10000 : val;
}

// Direct parsing at the correct offsets
const directGridPower = readInt16LE(payload, 0x00);
const directSolarPower = readInt16LE(payload, 0x02);
const directPowerRating = readUint16LE(payload, 0x4A);
const directFwMajor = payload[0x4C];
const directFwMinor = payload[0x4D];
const directApiPort = readUint16LE(payload, 0x66);

console.log(`Direct Grid Power: ${directGridPower}W`);
console.log(`Direct Solar Power: ${directSolarPower}W`);
console.log(`Direct Power Rating: ${directPowerRating}W`);
console.log(`Direct Firmware: v${directFwMajor}.${directFwMinor}`);
console.log(`Direct API Port: ${directApiPort}`);

console.log('\nDirect vs TypeScript Parser:');
console.log('-----------------------------');
console.log(`Power Rating: Direct=${directPowerRating}W, TS should show=${directPowerRating}W`);
console.log(`Firmware: Direct=v${directFwMajor}.${directFwMinor}, TS should show=v${directFwMajor}.${directFwMinor}`);
console.log(`API Port: Direct=${directApiPort}, TS should show=${directApiPort}`);