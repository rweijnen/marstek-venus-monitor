// Test URL Config parser with sample data from screenshot
// Raw frame: 73 1D 23 51 77 30 37 56 35 56 6C 56 79 30 66 56 4B 30 76 56 58 56 35 56 51 30 78 56 63

// Create test data - full frame
const fullFrame = [0x73, 0x1D, 0x23, 0x51, 0x77, 0x30, 0x37, 0x56, 0x35, 0x56, 0x6C, 0x56, 0x79, 0x30, 0x66, 0x56, 0x4B, 0x30, 0x76, 0x56, 0x58, 0x56, 0x35, 0x56, 0x51, 0x30, 0x78, 0x56, 0x63];

// Extract payload (skip header: 0x73, length, 0x23, command)
const payload = fullFrame.slice(4); // Skip the first 4 bytes
console.log('Full frame length:', fullFrame.length);
console.log('Payload length:', payload.length);
console.log('Payload bytes:', payload.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

// Convert payload to string to see what it contains
console.log('\nPayload as ASCII:');
const asciiString = payload.map(b => {
    if (b >= 32 && b <= 126) {
        return String.fromCharCode(b);
    } else {
        return `[0x${b.toString(16).padStart(2, '0')}]`;
    }
}).join('');
console.log(asciiString);

// Try parsing with current URLConfig logic
console.log('\nTrying current URL Config parsing logic:');
try {
    const urlLength = payload[0];
    console.log('First byte (URL length?):', urlLength, `(0x${urlLength.toString(16)})`);
    
    if (urlLength < payload.length) {
        const urlBytes = payload.slice(1, 1 + urlLength);
        const url = new TextDecoder().decode(urlBytes);
        console.log('Extracted URL bytes:', urlBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        console.log('URL as string:', url);
        
        // Try to get port
        const portOffset = 1 + urlLength;
        if (portOffset + 1 < payload.length) {
            const portBytes = payload.slice(portOffset, portOffset + 2);
            const port = portBytes[0] + (portBytes[1] << 8); // Little endian
            console.log('Port bytes:', portBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            console.log('Port value (LE):', port);
        }
    }
} catch (error) {
    console.error('Parsing error:', error);
}

// Let's also try interpreting the entire payload as a string
console.log('\nEntire payload as string:');
try {
    const fullString = new TextDecoder().decode(payload);
    console.log('Full string:', JSON.stringify(fullString));
} catch (error) {
    console.log('Cannot decode as UTF-8, showing raw bytes');
}

// Pattern analysis - look for separators
console.log('\nPattern analysis:');
const asciiChars = payload.map(b => String.fromCharCode(b));
console.log('Raw string:', asciiChars.join(''));

// Check if 'V' is used as separator (0x56)
console.log('\nSplit by V (0x56):');
const parts = asciiChars.join('').split('V');
console.log('Parts:', parts);

// Try different interpretations
console.log('\nLooking for patterns:');
console.log('Hex pairs that could be encoded:');
for (let i = 0; i < payload.length - 1; i += 2) {
    const byte1 = payload[i];
    const byte2 = payload[i + 1];
    console.log(`Offset ${i.toString().padStart(2)}: 0x${byte1.toString(16).padStart(2, '0')} 0x${byte2.toString(16).padStart(2, '0')} = '${String.fromCharCode(byte1)}${String.fromCharCode(byte2)}'`);
}

// Maybe it's a different encoding or the response format is different for 0x51 responses
console.log('\nMaybe this is not a standard URL config format...');
console.log('The response command is 0x51, but we sent 0x1B (URL Config)');
console.log('This might be a different type of response that needs special handling');

// Try interpreting parts as different data types
console.log('\nTrying to interpret parts:');
parts.forEach((part, index) => {
    if (part.length > 0) {
        console.log(`Part ${index}: "${part}"`);
        
        // Try as hex if it contains only hex chars
        if (/^[0-9a-fA-F]+$/.test(part)) {
            console.log(`  - As hex: 0x${part} = ${parseInt(part, 16)}`);
        }
        
        // Try as characters
        if (part.length <= 4) {
            const charCodes = part.split('').map(c => c.charCodeAt(0));
            console.log(`  - Char codes: [${charCodes.join(', ')}]`);
        }
    }
});

// Maybe the format is completely different - let's try to find URL-like patterns
console.log('\nLooking for URL patterns in raw data:');
const rawString = asciiChars.join('');
console.log('Raw string:', rawString);

// Check if this might be base64 or similar encoding
console.log('\nChecking for common URL components:');
const urlIndicators = ['http', 'https', '.com', '.net', '.org', '://', '80', '443', '8080'];
urlIndicators.forEach(indicator => {
    if (rawString.toLowerCase().includes(indicator.toLowerCase())) {
        console.log(`Found URL indicator: ${indicator}`);
    }
});

// Try removing 'V' separators and see if we get readable data
const withoutV = rawString.replace(/V/g, '');
console.log('Without V separators:', withoutV);

// CAESAR CIPHER ANALYSIS!
console.log('\n=== TESTING CAESAR CIPHER ===');
const withoutVString = withoutV;

// Try different Caesar shifts (0-25)
for (let shift = 0; shift <= 25; shift++) {
    const decoded = withoutVString.split('').map(char => {
        const code = char.charCodeAt(0);
        
        if (code >= 65 && code <= 90) { // A-Z
            return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
        } else if (code >= 97 && code <= 122) { // a-z
            return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
        } else if (code >= 48 && code <= 57) { // 0-9 (maybe shifted in ASCII)
            return char; // Keep numbers as-is for now
        }
        return char; // Keep other characters as-is
    }).join('');
    
    console.log(`Shift ${shift.toString().padStart(2)}: ${decoded}`);
    
    // Check if this looks like a URL
    if (decoded.toLowerCase().includes('http') || decoded.toLowerCase().includes('.com') || decoded.toLowerCase().includes('://')) {
        console.log(`  *** POSSIBLE URL FOUND! ***`);
    }
}

// Also try reverse shifts
console.log('\n=== TESTING REVERSE CAESAR (FORWARD SHIFTS) ===');
for (let shift = 1; shift <= 25; shift++) {
    const decoded = withoutVString.split('').map(char => {
        const code = char.charCodeAt(0);
        
        if (code >= 65 && code <= 90) { // A-Z
            return String.fromCharCode(((code - 65 + shift) % 26) + 65);
        } else if (code >= 97 && code <= 122) { // a-z
            return String.fromCharCode(((code - 97 + shift) % 26) + 97);
        }
        return char;
    }).join('');
    
    console.log(`Forward shift ${shift.toString().padStart(2)}: ${decoded}`);
    
    if (decoded.toLowerCase().includes('http') || decoded.toLowerCase().includes('.com') || decoded.toLowerCase().includes('://')) {
        console.log(`  *** POSSIBLE URL FOUND! ***`);
    }
}