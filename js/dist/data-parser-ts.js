/**
 * Marstek Venus E Data Parser - TypeScript Version
 *
 * Clean, type-safe parser using class-based architecture
 */
import { createPayload } from './protocol/payloads/index.js';
/**
 * Parse BLE response data and return formatted HTML
 * @param data - Raw response data
 * @param commandName - Name of the command (for logging)
 * @returns HTML formatted output
 */
export function parseResponse(data, commandName) {
    try {
        // Log raw data for debugging
        if (window.uiController && window.uiController.log) {
            window.uiController.log(`📊 Raw Response (${data.length} bytes): ${formatBytes(data)}`);
            window.uiController.log(`📋 Hex Dump:\n${formatHexDump(data)}`);
            window.uiController.log(`🔍 Command: 0x${data[3]?.toString(16).padStart(2, '0').toUpperCase()}, Payload: ${data.length - 5} bytes`);
        }
        // Create appropriate payload parser
        const payload = createPayload(data);
        // Generate HTML output
        return payload.toHTML();
    }
    catch (error) {
        console.error('Parser error:', error);
        const commandByte = data.length > 3 ? data[3] : 0;
        return `
            <h3>❌ Parse Error</h3>
            <div class="error">
                <p><strong>Command:</strong> 0x${commandByte.toString(16).padStart(2, '0').toUpperCase()}</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Data Length:</strong> ${data.length} bytes</p>
            </div>
        `;
    }
}
/**
 * Format byte array as hex string
 */
function formatBytes(data) {
    return Array.from(data)
        .map(b => '0x' + b.toString(16).padStart(2, '0'))
        .join(' ');
}
/**
 * Format hex dump for detailed analysis
 */
function formatHexDump(data) {
    let hexDump = '';
    for (let i = 0; i < data.length; i += 16) {
        // Address
        hexDump += i.toString(16).padStart(4, '0') + ': ';
        // Hex bytes
        let hexPart = '';
        let asciiPart = '';
        for (let j = 0; j < 16; j++) {
            if (i + j < data.length) {
                const byte = data[i + j];
                hexPart += byte.toString(16).padStart(2, '0').toUpperCase() + ' ';
                // ASCII representation (printable chars only)
                asciiPart += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            }
            else {
                hexPart += '   ';
            }
            // Add extra space in middle
            if (j === 7)
                hexPart += ' ';
        }
        hexDump += hexPart + ' |' + asciiPart + '|\n';
    }
    return hexDump;
}
// Export legacy functions for compatibility
export { formatBytes, formatHexDump };
// Make available globally for existing JavaScript code
if (typeof window !== 'undefined') {
    window.dataParserTS = {
        parseResponse,
        formatBytes,
        formatHexDump
    };
}
