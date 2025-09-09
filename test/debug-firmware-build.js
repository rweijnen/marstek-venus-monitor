// Debug the firmware build timestamp parsing

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
const payload = data.slice(4, -1);

console.log('Firmware Build Timestamp Debug');
console.log('==============================');
console.log(`Payload length: ${payload.length} bytes\n`);

// Expected location: payload offset 0x50 (raw offset 0x54)
console.log('Expected firmware timestamp at payload offset 0x50 (12 bytes):');
for (let i = 0; i < 12; i++) {
    const offset = 0x50 + i;
    if (offset < payload.length) {
        const byte = payload[offset];
        const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        console.log(`  payload[0x${offset.toString(16)}] = 0x${byte.toString(16).padStart(2, '0')} (${byte}) '${char}'`);
    } else {
        console.log(`  payload[0x${offset.toString(16)}] = OUT OF BOUNDS`);
    }
}

console.log('\nFirmware timestamp string attempt:');
let firmwareStr = '';
for (let i = 0; i < 12; i++) {
    const offset = 0x50 + i;
    if (offset < payload.length && payload[offset] !== 0) {
        firmwareStr += String.fromCharCode(payload[offset]);
    }
}
console.log(`String: "${firmwareStr}"`);
console.log(`Length: ${firmwareStr.length}`);
console.log(`Is numeric: ${/^\d+$/.test(firmwareStr)}`);

// Look for the expected pattern "20240909015" around different offsets
console.log('\nSearching for ASCII "20240909" pattern:');
const searchPattern = [0x32, 0x30, 0x32, 0x34, 0x30, 0x39, 0x30, 0x39]; // "20240909"
for (let i = 0; i < payload.length - 8; i++) {
    let match = true;
    for (let j = 0; j < 8; j++) {
        if (payload[i + j] !== searchPattern[j]) {
            match = false;
            break;
        }
    }
    if (match) {
        console.log(`Found "20240909" at payload offset 0x${i.toString(16).padStart(2, '0')}`);
        
        // Show 12 bytes starting from this position
        let timestamp = '';
        for (let k = 0; k < 12; k++) {
            if (i + k < payload.length) {
                timestamp += String.fromCharCode(payload[i + k]);
            }
        }
        console.log(`  12-byte timestamp: "${timestamp}"`);
        
        // Test the parsing logic
        if (timestamp.length >= 12 && /^\d+/.test(timestamp)) {
            const cleaned = timestamp.slice(0, 12);
            const formatted = `${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)} ${cleaned.slice(8,10)}:${cleaned.slice(10,12)}`;
            console.log(`  Formatted: ${formatted}`);
        }
    }
}

console.log('\nHex dump around expected area (payload 0x48-0x60):');
for (let i = 0x48; i < Math.min(0x60, payload.length); i += 16) {
    let line = `${i.toString(16).padStart(4, '0')}: `;
    let ascii = '';
    for (let j = 0; j < 16 && i + j < payload.length && i + j < 0x60; j++) {
        const byte = payload[i + j];
        line += byte.toString(16).padStart(2, '0').toUpperCase() + ' ';
        ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
    }
    line += ' |' + ascii + '|';
    console.log(line);
}

console.log('\nPayload structure analysis:');
console.log(`Power Rating @ 0x4A: ${(payload[0x4B] << 8) | payload[0x4A]}W`);
console.log(`Firmware @ 0x4C-0x4D: v${payload[0x4C]}.${payload[0x4D]}`);
console.log(`Build Code @ 0x4E: ${(payload[0x4F] << 8) | payload[0x4E]}`);
console.log(`Expected timestamp @ 0x50: Should be here...`);