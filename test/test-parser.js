// Test the TypeScript parser with actual hex data from the user

// Test data from user's last message
const hexData = [
    0x02, 0x00, 0x73, 0x03, 0xea, 0xff, 0x00, 0x00, 0x0e, 0x0a, 0x02, 0x01, 
    0x01, 0x00, 0x00, 0x02, 0xca, 0x72, 0xcc, 0x02, 0x0e, 0x02, 0xcc, 0x00,
    0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0xc8, 0x02, 0xcc, 0x00, 0x01, 0x02,
    0x00, 0x00, 0x00, 0x00, 0xc8, 0x02, 0xcc, 0x00, 0x08, 0xdc, 0xc2, 0xa1,
    0x08, 0x5b, 0xd9, 0xa1, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0xc4, 0x09,
    0x03, 0x02, 0x06, 0x89, 0x32, 0x30, 0x32, 0x34, 0x31, 0x32, 0x31, 0x33,
    0x31, 0x35, 0x35, 0x38, 0x00, 0x00, 0x23, 0x01, 0x00, 0x07, 0x00, 0x01,
    0x00, 0x01, 0x30, 0x75, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x8f
];

const data = new Uint8Array(hexData);

console.log('Test Data Analysis:');
console.log('==================');
console.log(`Total length: ${data.length} bytes`);
console.log(`Header: 0x${data[0].toString(16).padStart(2, '0')} 0x${data[1].toString(16).padStart(2, '0')} 0x${data[2].toString(16).padStart(2, '0')} 0x${data[3].toString(16).padStart(2, '0')}`);
console.log(`Command: 0x${data[3].toString(16).padStart(2, '0')}`);
console.log(`Payload starts at index 4, ends at index ${data.length - 2}`);
console.log(`Checksum: 0x${data[data.length - 1].toString(16).padStart(2, '0')}`);
console.log('');

// Extract payload (skip header, exclude checksum)
const payload = data.slice(4, -1);
console.log(`Payload length: ${payload.length} bytes`);
console.log('');

// Manual parsing to verify expected values
console.log('Manual Parsing (using payload offsets):');
console.log('========================================');

// Helper functions
function readInt16LE(arr, offset) {
    return (arr[offset + 1] << 8) | arr[offset];
}

function readUint16LE(arr, offset) {
    return ((arr[offset + 1] << 8) | arr[offset]) >>> 0;
}

function readUint16BE(arr, offset) {
    return ((arr[offset] << 8) | arr[offset + 1]) >>> 0;
}

function readUint32LE(arr, offset) {
    return (arr[offset] | (arr[offset + 1] << 8) | (arr[offset + 2] << 16) | (arr[offset + 3] << 24)) >>> 0;
}

// Parse key fields using PAYLOAD offsets
const gridPower = readInt16LE(payload, 0x00);
console.log(`Grid Power @ payload[0x00]: ${gridPower}W (raw: 0x${payload[0x00].toString(16).padStart(2, '0')} 0x${payload[0x01].toString(16).padStart(2, '0')})`);

const solarPower = readInt16LE(payload, 0x02);
console.log(`Solar Power @ payload[0x02]: ${solarPower}W (raw: 0x${payload[0x02].toString(16).padStart(2, '0')} 0x${payload[0x03].toString(16).padStart(2, '0')})`);

const workMode = payload[0x04];
console.log(`Work Mode @ payload[0x04]: 0x${workMode.toString(16).padStart(2, '0')}`);

// Energy totals
const energyTotal1 = readUint32LE(payload, 0x2A);
console.log(`Energy Total 1 @ payload[0x2A]: ${energyTotal1} (raw: 0x${payload[0x2A].toString(16).padStart(2, '0')} 0x${payload[0x2B].toString(16).padStart(2, '0')} 0x${payload[0x2C].toString(16).padStart(2, '0')} 0x${payload[0x2D].toString(16).padStart(2, '0')})`);

const energyTotal2 = readUint32LE(payload, 0x2E);
console.log(`Energy Total 2 @ payload[0x2E]: ${energyTotal2} (raw: 0x${payload[0x2E].toString(16).padStart(2, '0')} 0x${payload[0x2F].toString(16).padStart(2, '0')} 0x${payload[0x30].toString(16).padStart(2, '0')} 0x${payload[0x31].toString(16).padStart(2, '0')})`);

// Let's check what's at raw offset 0x4A (payload offset 0x46)
console.log('\nChecking raw offset 0x4A (should be 0xc4 0x09 = 2500):');
console.log(`  data[0x4A]: 0x${data[0x4A].toString(16).padStart(2, '0')}`);
console.log(`  data[0x4B]: 0x${data[0x4B].toString(16).padStart(2, '0')}`);
const powerRatingAtRaw4A = readUint16LE(data, 0x4A);
console.log(`  Value at raw 0x4A: ${powerRatingAtRaw4A}W`);

// Power rating is at RAW offset 0x4A, which is payload offset 0x46
const powerRating = readUint16LE(payload, 0x46);
console.log(`Power Rating @ payload[0x46]: ${powerRating}W (raw: 0x${payload[0x46].toString(16).padStart(2, '0')} 0x${payload[0x47].toString(16).padStart(2, '0')})`);

// But wait, let's check the ACTUAL location of 0xc4 0x09 in the data
console.log('\nSearching for 0xc4 0x09 in data:');
for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0xc4 && data[i+1] === 0x09) {
        console.log(`  Found 0xc4 0x09 at raw offset 0x${i.toString(16).padStart(2, '0')} (payload offset 0x${(i-4).toString(16).padStart(2, '0')})`);
    }
}

// Let's also find 0x03 0x02 (firmware version)
console.log('\nSearching for 0x03 0x02 (v3.2) in data:');
for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0x03 && data[i+1] === 0x02) {
        console.log(`  Found 0x03 0x02 at raw offset 0x${i.toString(16).padStart(2, '0')} (payload offset 0x${(i-4).toString(16).padStart(2, '0')})`);
    }
}

// Let's also find 0x06 0x89 (build code 1673 in BE)
console.log('\nSearching for 0x06 0x89 (build 1673) in data:');
for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0x06 && data[i+1] === 0x89) {
        console.log(`  Found 0x06 0x89 at raw offset 0x${i.toString(16).padStart(2, '0')} (payload offset 0x${(i-4).toString(16).padStart(2, '0')})`);
    }
}

// Let's also find 0x30 0x75 (API port 30000 in LE)
console.log('\nSearching for 0x30 0x75 (port 30000) in data:');
for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0x30 && data[i+1] === 0x75) {
        console.log(`  Found 0x30 0x75 at raw offset 0x${i.toString(16).padStart(2, '0')} (payload offset 0x${(i-4).toString(16).padStart(2, '0')})`);
    }
}

// Now parse at the CORRECT offsets
console.log('\n=== CORRECT PARSING ===');
const correctPowerRating = readUint16LE(data, 0x46);  // Raw offset 0x46
console.log(`Power Rating @ raw[0x46]: ${correctPowerRating}W`);

const correctFwMajor = data[0x4C];  // Raw offset 0x4C
const correctFwMinor = data[0x4D];  // Raw offset 0x4D
console.log(`Firmware Version @ raw[0x4C-0x4D]: v${correctFwMajor}.${correctFwMinor}`);

const correctBuildCode = readUint16BE(data, 0x4E);  // Raw offset 0x4E
console.log(`Build Code @ raw[0x4E]: ${correctBuildCode}`);

const correctApiPort = readUint16LE(data, 0x67);  // Raw offset 0x67
console.log(`API Port @ raw[0x67]: ${correctApiPort}`);

console.log('\n');
console.log('Expected vs Actual:');
console.log('===================');
console.log('Power Rating: Expected 2500W, Got', powerRating + 'W', powerRating === 2500 ? '✅' : '❌');
console.log('Firmware Version: Expected v3.2, Got v' + fwMajor + '.' + fwMinor, (fwMajor === 3 && fwMinor === 2) ? '✅' : '❌');
console.log('Build Code: Expected 1673 (0x0689), Got', buildCode, buildCode === 1673 ? '✅' : '❌');
console.log('API Port: Expected 30000 (0x7530), Got', apiPort, apiPort === 30000 ? '✅' : '❌');

// Now test the TypeScript parser if available
console.log('\n');
console.log('Testing TypeScript Parser:');
console.log('==========================');

try {
    // Try to load the TypeScript modules
    const { createPayload } = require('../js/protocol/payloads/index.js');
    const payload = createPayload(data);
    const result = payload.parse();
    
    console.log('TypeScript Parser Results:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\nTypeScript Parser Validation:');
    console.log('Power Rating:', result.powerRating, result.powerRating === 2500 ? '✅' : '❌');
    console.log('Firmware Version:', result.firmwareVersion, result.firmwareVersion === 'v3.2' ? '✅' : '❌');
    console.log('Build Code:', result.buildCode, result.buildCode === 1673 ? '✅' : '❌');
    console.log('API Port:', result.apiPort, result.apiPort === 30000 ? '✅' : '❌');
} catch (error) {
    console.log('Could not load TypeScript parser:', error.message);
    console.log('This is expected if TypeScript hasn\'t been compiled yet.');
}