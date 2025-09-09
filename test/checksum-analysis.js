// Analyze the checksum calculation to find the correct method

// Your latest runtime data
const hexData = [
    0x73, 0x6d, 0x23, 0x03, 0x00, 0x00, 0xf3, 0x00, 0x03, 0x01, 0x01, 0x01, 
    0x03, 0xc2, 0x01, 0x58, 0x99, 0x00, 0xff, 0x00, 0x00, 0x00, 0x7c, 0x73, 
    0x00, 0x00, 0x73, 0x00, 0x00, 0x00, 0x8a, 0x08, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0x8e, 0x00, 
    0x00, 0xec, 0x69, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc4, 0x09, 0x03, 0x02, 0x01, 0xd7, 
    0x00, 0x32, 0x30, 0x32, 0x34, 0x30, 0x39, 0x30, 0x39, 0x30, 0x31, 0x35, 
    0x39, 0x00, 0x00, 0x01, 0x00, 0xff, 0x03, 0xf2, 0x64, 0x01, 0x30, 0x75, 
    0xb0
];

const data = new Uint8Array(hexData);

console.log('Checksum Analysis');
console.log('=================');
console.log(`Data length: ${data.length} bytes`);
console.log(`Expected checksum: 0x${data[data.length - 1].toString(16).padStart(2, '0')}`);
console.log('');

// Method 1: Current TypeScript implementation (XOR bytes 1 to length-2)
console.log('Method 1: XOR from index 1 to length-2 (current TS):');
let checksum1 = 0;
for (let i = 1; i < data.length - 1; i++) {
    checksum1 ^= data[i];
}
console.log(`Calculated: 0x${checksum1.toString(16).padStart(2, '0')} ${checksum1 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 2: XOR from index 0 to length-2  
console.log('Method 2: XOR from index 0 to length-2:');
let checksum2 = 0;
for (let i = 0; i < data.length - 1; i++) {
    checksum2 ^= data[i];
}
console.log(`Calculated: 0x${checksum2.toString(16).padStart(2, '0')} ${checksum2 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 3: XOR header bytes only (0-3)
console.log('Method 3: XOR header bytes only (0-3):');
let checksum3 = 0;
for (let i = 0; i < 4; i++) {
    checksum3 ^= data[i];
}
console.log(`Calculated: 0x${checksum3.toString(16).padStart(2, '0')} ${checksum3 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 4: XOR payload only (4 to length-2)
console.log('Method 4: XOR payload only (4 to length-2):');
let checksum4 = 0;
for (let i = 4; i < data.length - 1; i++) {
    checksum4 ^= data[i];
}
console.log(`Calculated: 0x${checksum4.toString(16).padStart(2, '0')} ${checksum4 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 5: XOR from index 1 to 3 (header without start byte)
console.log('Method 5: XOR header bytes 1-3:');
let checksum5 = 0;
for (let i = 1; i < 4; i++) {
    checksum5 ^= data[i];
}
console.log(`Calculated: 0x${checksum5.toString(16).padStart(2, '0')} ${checksum5 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 6: XOR all data except checksum, but skip start byte
console.log('Method 6: XOR bytes 1-3 and payload (1-3, 4 to length-2):');
let checksum6 = 0;
// XOR header bytes 1-3
for (let i = 1; i < 4; i++) {
    checksum6 ^= data[i];
}
// XOR payload bytes
for (let i = 4; i < data.length - 1; i++) {
    checksum6 ^= data[i];
}
console.log(`Calculated: 0x${checksum6.toString(16).padStart(2, '0')} ${checksum6 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 7: Sum all bytes modulo 256
console.log('Method 7: Sum all bytes (0 to length-2) mod 256:');
let checksum7 = 0;
for (let i = 0; i < data.length - 1; i++) {
    checksum7 = (checksum7 + data[i]) & 0xFF;
}
console.log(`Calculated: 0x${checksum7.toString(16).padStart(2, '0')} ${checksum7 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 8: Sum payload only
console.log('Method 8: Sum payload bytes (4 to length-2) mod 256:');
let checksum8 = 0;
for (let i = 4; i < data.length - 1; i++) {
    checksum8 = (checksum8 + data[i]) & 0xFF;
}
console.log(`Calculated: 0x${checksum8.toString(16).padStart(2, '0')} ${checksum8 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 9: Two's complement checksum
console.log('Method 9: Two\'s complement of sum (payload):');
let sum9 = 0;
for (let i = 4; i < data.length - 1; i++) {
    sum9 += data[i];
}
let checksum9 = (~sum9 + 1) & 0xFF;
console.log(`Calculated: 0x${checksum9.toString(16).padStart(2, '0')} ${checksum9 === data[data.length - 1] ? '✅' : '❌'}`);

// Method 10: Simple XOR of specific bytes patterns
console.log('Method 10: XOR of all except start byte and checksum:');
let checksum10 = 0;
for (let i = 1; i < data.length - 1; i++) {
    checksum10 ^= data[i];
}
console.log(`Calculated: 0x${checksum10.toString(16).padStart(2, '0')} ${checksum10 === data[data.length - 1] ? '✅' : '❌'}`);

console.log('\nDetailed breakdown:');
console.log('===================');
console.log('Header: 0x73 0x6d 0x23 0x03');
console.log(`Start byte: 0x${data[0].toString(16).padStart(2, '0')} (${data[0]})`);
console.log(`Length: 0x${data[1].toString(16).padStart(2, '0')} (${data[1]})`);  
console.log(`Identifier: 0x${data[2].toString(16).padStart(2, '0')} (${data[2]})`);
console.log(`Command: 0x${data[3].toString(16).padStart(2, '0')} (${data[3]})`);
console.log(`Expected checksum: 0x${data[data.length - 1].toString(16).padStart(2, '0')} (${data[data.length - 1]})`);

// Test some alternative approaches
console.log('\nAlternative checksum calculations:');
console.log('===================================');

// Maybe it's a CRC or different algorithm?
let testXor = data[1] ^ data[2] ^ data[3]; // Just header without start byte
console.log(`Just header XOR (bytes 1-3): 0x${testXor.toString(16).padStart(2, '0')} ${testXor === data[data.length - 1] ? '✅' : '❌'}`);

// Maybe start from a different initial value?
let testXor2 = 0x00;
for (let i = 0; i < data.length - 1; i++) {
    testXor2 ^= data[i];
}
console.log(`XOR all including start byte: 0x${testXor2.toString(16).padStart(2, '0')} ${testXor2 === data[data.length - 1] ? '✅' : '❌'}`);

// Manual calculation for verification
console.log('\nStep-by-step XOR (Method 1 - current TS):');
let stepByStep = 0;
for (let i = 1; i < data.length - 1; i++) {
    stepByStep ^= data[i];
    if (i < 10 || i % 10 === 0) {
        console.log(`Step ${i}: 0x${data[i].toString(16).padStart(2, '0')} -> running XOR = 0x${stepByStep.toString(16).padStart(2, '0')}`);
    }
}
console.log(`Final: 0x${stepByStep.toString(16).padStart(2, '0')}`);