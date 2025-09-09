// Test the runtime info parsing with actual data from user

const hexData = [
    0x73, 0x6d, 0x23, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 
    0x01, 0xcc, 0x01, 0x5a, 0x99, 0x00, 0xff, 0x00, 0x00, 0x00, 0x7c, 0x73, 
    0x00, 0x00, 0x6a, 0x00, 0x00, 0x00, 0x81, 0x08, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0x8e, 0x00, 
    0x00, 0xe2, 0x69, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc4, 0x09, 0x03, 0x02, 0x01, 0xd7, 
    0x00, 0x32, 0x30, 0x32, 0x34, 0x30, 0x39, 0x30, 0x39, 0x30, 0x31, 0x35, 
    0x39, 0x00, 0x00, 0x01, 0x00, 0xff, 0x03, 0xf2, 0x64, 0x01, 0x30, 0x75, 
    0x52
];

const data = new Uint8Array(hexData);

console.log('Runtime Info Test Data Analysis:');
console.log('=================================');
console.log(`Total length: ${data.length} bytes`);
console.log(`Header: 0x${data[0].toString(16)} 0x${data[1].toString(16)} 0x${data[2].toString(16)} 0x${data[3].toString(16)}`);
console.log(`Command: 0x${data[3].toString(16)} (Runtime Info)`);

// Extract payload (skip first 4 bytes header, exclude last byte checksum)
const payload = data.slice(4, -1);
console.log(`Payload length: ${payload.length} bytes\n`);

// Helper functions
function readInt16LE(arr, offset) {
    const val = (arr[offset + 1] << 8) | arr[offset];
    return val > 0x7FFF ? val - 0x10000 : val;
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

// Search for known values in the data
console.log('Searching for known values:');
console.log('----------------------------');

// Find 0xc4 0x09 (2500W)
for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0xc4 && data[i+1] === 0x09) {
        console.log(`Found 0xc4 0x09 (2500W) at raw offset 0x${i.toString(16)} (payload offset 0x${(i-4).toString(16)})`);
    }
}

// Find 0x03 0x02 (v3.2)
for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0x03 && data[i+1] === 0x02) {
        console.log(`Found 0x03 0x02 (v3.2) at raw offset 0x${i.toString(16)} (payload offset 0x${(i-4).toString(16)})`);
    }
}

// Find 0x30 0x75 (port 30000)
for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0x30 && data[i+1] === 0x75) {
        console.log(`Found 0x30 0x75 (port 30000) at raw offset 0x${i.toString(16)} (payload offset 0x${(i-4).toString(16)})`);
    }
}

console.log('\nParsing at discovered offsets:');
console.log('-------------------------------');

// Parse key fields using PAYLOAD offsets
const gridPower = readInt16LE(payload, 0x00);
console.log(`Grid Power @ payload[0x00]: ${gridPower}W`);

const solarPower = readInt16LE(payload, 0x02);
console.log(`Solar Power @ payload[0x02]: ${solarPower}W`);

const workMode = payload[0x04];
console.log(`Work Mode @ payload[0x04]: 0x${workMode.toString(16)}`);

// Power rating at payload offset 0x4a (raw 0x4e)
const powerRating = readUint16LE(payload, 0x4a);
console.log(`Power Rating @ payload[0x4a]: ${powerRating}W`);

// Firmware version at payload offset 0x4c (raw 0x50)
const fwMajor = payload[0x4c];
const fwMinor = payload[0x4d];
console.log(`Firmware Version @ payload[0x4c-0x4d]: v${fwMajor}.${fwMinor}`);

// Build code at payload offset 0x4e (raw 0x52)
const buildCode = readUint16BE(payload, 0x4e);
console.log(`Build Code @ payload[0x4e]: ${buildCode} (0x${buildCode.toString(16)})`);

// Firmware timestamp starting at payload offset 0x50 (raw 0x54)
let firmwareTimestamp = '';
for (let i = 0; i < 12; i++) {
    if (payload[0x50 + i]) {
        firmwareTimestamp += String.fromCharCode(payload[0x50 + i]);
    }
}
console.log(`Firmware Timestamp @ payload[0x50]: "${firmwareTimestamp}"`);

// API Port at payload offset 0x66 (raw 0x6a)
const apiPort = readUint16LE(payload, 0x66);
console.log(`API Port @ payload[0x66]: ${apiPort}`);

console.log('\nValidation:');
console.log('-----------');
console.log('Power Rating:', powerRating === 2500 ? `✅ ${powerRating}W` : `❌ ${powerRating}W (expected 2500W)`);
console.log('Firmware Version:', (fwMajor === 3 && fwMinor === 2) ? `✅ v${fwMajor}.${fwMinor}` : `❌ v${fwMajor}.${fwMinor} (expected v3.2)`);
console.log('Build Code:', buildCode === 471 ? `✅ ${buildCode}` : `❌ ${buildCode} (maybe different than expected)`);
console.log('API Port:', apiPort === 30000 ? `✅ ${apiPort}` : `❌ ${apiPort} (expected 30000)`);
console.log('Firmware Timestamp:', firmwareTimestamp.length === 12 ? `✅ "${firmwareTimestamp}"` : `❌ "${firmwareTimestamp}"`);

// Print hex dump for manual verification
console.log('\nHex dump (first 80 bytes of payload):');
console.log('--------------------------------------');
for (let i = 0; i < Math.min(80, payload.length); i += 16) {
    let line = i.toString(16).padStart(4, '0') + ': ';
    for (let j = 0; j < 16 && i + j < payload.length; j++) {
        line += payload[i + j].toString(16).padStart(2, '0') + ' ';
    }
    console.log(line);
}