import { BasePayload } from '../base/Payload.js';

/**
 * Developer Mode Info payload (Command 0x0D)
 * Contains development/debugging configuration parameters
 * Firmware calls this "Develop mode info" and sends 19 bytes
 */
export class DeveloperModeInfo extends BasePayload {
    public parse() {
        let offset = 0;
        
        // Parse the 19-byte developer mode payload
        // Based on captured data: [0x01, 0x31, 0x00, 0xf4, 0x00, 0x00, 0x00, 0x28, 0x00, 0x23, 0x00, 0x23, 0x00, 0x1e, 0x00, 0x1d, 0x00, 0x00, 0x00]
        
        const mode = offset < this.payload.length ? this.payload[offset++] : 0; // 0x01 = 1
        const param1 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x31 = 49
        
        // Parse subsequent 16-bit little-endian values
        const value1 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // 0xf4 = 244
        offset += 2;
        const value2 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // 0x00 = 0
        offset += 2;
        const value3 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // 0x28 = 40
        offset += 2;
        const value4 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // 0x23 = 35
        offset += 2;
        const value5 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // 0x23 = 35
        offset += 2;
        const value6 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // 0x1e = 30
        offset += 2;
        const value7 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // 0x1d = 29
        offset += 2;
        const value8 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0; // 0x00 = 0
        offset += 2;
        
        const finalByte = offset < this.payload.length ? this.payload[offset++] : 0; // 0x00
        
        return {
            type: 'DeveloperModeInfo',
            mode,
            param1,
            configValues: [value1, value2, value3, value4, value5, value6, value7, value8],
            finalByte,
            // Interpret values based on actual data: [62464, 0, 10240, 8960, 8960, 7680, 7424, 0]
            // These large values suggest memory addresses, timer intervals, or configuration parameters
            interpretations: {
                mode: mode === 1 ? 'Development Mode Active' : `Mode ${mode}`,
                param1: `Parameter: ${param1}`,
                value1: `Timer/Address 1: ${value1} (0x${value1.toString(16)})`, // 62464 = 0xF400
                value2: `Timer/Address 2: ${value2}`, // 0
                value3: `Timer/Address 3: ${value3} (0x${value3.toString(16)})`, // 10240 = 0x2800  
                value4: `Timer/Address 4: ${value4} (0x${value4.toString(16)})`, // 8960 = 0x2300
                value5: `Timer/Address 5: ${value5} (0x${value5.toString(16)})`, // 8960 = 0x2300 (duplicate)
                value6: `Timer/Address 6: ${value6} (0x${value6.toString(16)})`, // 7680 = 0x1E00
                value7: `Timer/Address 7: ${value7} (0x${value7.toString(16)})`, // 7424 = 0x1D00
                value8: `Timer/Address 8: ${value8}` // 0
            }
        };
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>Developer Mode Info</h3>
            <div class="data-grid">
                <div><strong>Mode:</strong> ${data.interpretations.mode}</div>
                <div><strong>Parameter:</strong> ${data.param1}</div>
                <div><strong>Config Values:</strong></div>
                ${data.configValues.map((val, idx) => 
                    `<div style="margin-left: 20px;"><strong>Value ${idx + 1}:</strong> ${val}</div>`
                ).join('')}
                <div><strong>Final Byte:</strong> ${data.finalByte}</div>
                <div><strong>Raw Payload:</strong> ${Array.from(this.payload).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}</div>
            </div>
        `;
    }
}