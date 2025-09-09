// Test the DeviceInfo parser with actual device data

import { parseResponse } from '../js/dist/data-parser-ts.js';

// Your actual device info data
const hexData = [
    0x73, 0x66, 0x23, 0x04, 0x74, 0x79, 0x70, 0x65, 0x3d, 0x48, 0x4d, 0x47, 
    0x2d, 0x35, 0x30, 0x2c, 0x69, 0x64, 0x3d, 0x32, 0x30, 0x33, 0x39, 0x33, 
    0x35, 0x34, 0x65, 0x34, 0x31, 0x33, 0x32, 0x35, 0x30, 0x31, 0x34, 0x34, 
    0x65, 0x30, 0x30, 0x32, 0x34, 0x2c, 0x6d, 0x61, 0x63, 0x3d, 0x32, 0x34, 
    0x32, 0x31, 0x35, 0x65, 0x65, 0x35, 0x38, 0x32, 0x39, 0x64, 0x2c, 0x64, 
    0x65, 0x76, 0x5f, 0x76, 0x65, 0x72, 0x3d, 0x31, 0x35, 0x33, 0x2c, 0x62, 
    0x6d, 0x73, 0x5f, 0x76, 0x65, 0x72, 0x3d, 0x38, 0x36, 0x2c, 0x66, 0x63, 
    0x5f, 0x76, 0x65, 0x72, 0x3d, 0x32, 0x30, 0x32, 0x34, 0x30, 0x39, 0x30, 
    0x39, 0x30, 0x31, 0x35, 0x39, 0x50
];

const data = new Uint8Array(hexData);

console.log('Device Info Parser Test');
console.log('=======================');
console.log(`Data length: ${data.length} bytes`);
console.log(`Command: 0x${data[3].toString(16).padStart(2, '0').toUpperCase()}`);

// Extract and display the ASCII text for verification
const payload = data.slice(4, -1);
let asciiText = '';
for (let i = 0; i < payload.length; i++) {
    asciiText += String.fromCharCode(payload[i]);
}
console.log(`ASCII payload: "${asciiText}"`);
console.log('');

// Mock the window object for the TypeScript parser
global.window = {
    uiController: {
        log: (msg) => console.log(`[DEBUG] ${msg}`)
    }
};

try {
    console.log('Testing TypeScript Device Info Parser...');
    const htmlOutput = parseResponse(data, 'Device Info');
    
    console.log('HTML Output:');
    console.log('============');
    console.log(htmlOutput);
    
    // Extract key values for analysis
    console.log('\nParsed Data Analysis:');
    console.log('=====================');
    
    const deviceTypeMatch = htmlOutput.match(/<strong>Device Type:<\/strong>\s*([^<]+)/);
    const deviceIdMatch = htmlOutput.match(/<strong>Device ID:<\/strong>\s*([^<]+)/);
    const macMatch = htmlOutput.match(/<strong>MAC Address:<\/strong>\s*([^<]+)/);
    const devVerMatch = htmlOutput.match(/<strong>Device Version:<\/strong>\s*([^<]+)/);
    const bmsVerMatch = htmlOutput.match(/<strong>BMS Version:<\/strong>\s*([^<]+)/);
    const fcVerMatch = htmlOutput.match(/<strong>FC Version:<\/strong>\s*([^<]+)/);
    
    console.log(`Device Type: ${deviceTypeMatch ? deviceTypeMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`Device ID: ${deviceIdMatch ? deviceIdMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`MAC Address: ${macMatch ? macMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`Device Version: ${devVerMatch ? devVerMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`BMS Version: ${bmsVerMatch ? bmsVerMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`FC Version: ${fcVerMatch ? fcVerMatch[1].trim() : 'NOT FOUND'}`);
    
    console.log('\nInteresting findings:');
    console.log('====================');
    console.log('• Device Type: HMG-50 (appears to be the model identifier)');
    console.log('• MAC: 24215ee5829d (Bluetooth MAC address)');
    console.log('• Device Version: 153 (device firmware/software version)');
    console.log('• BMS Version: 86 (Battery Management System version)');
    console.log('• FC Version: 202409090159P (matches firmware timestamp from runtime info!)');
    
} catch (error) {
    console.error('Error testing Device Info parser:', error);
    console.error('Stack:', error.stack);
}