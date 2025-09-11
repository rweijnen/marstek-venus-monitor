import { BasePayload } from '../base/Payload.js';

/**
 * Settings Info payload (Command 0x0A)
 * Contains device settings and configuration information
 */
export class SettingsInfo extends BasePayload {
    public parse() {
        // Parse the 80-byte settings payload
        // Based on the screenshot showing command 0x0A with 80 bytes
        
        const data = {
            type: 'SettingsInfo',
            payloadLength: this.payload.length,
            rawData: Array.from(this.payload).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
        };
        
        // Try to extract meaningful information from the payload
        if (this.payload.length >= 4) {
            // First few bytes might contain identifiers or status
            data.firstBytes = {
                byte0: this.payload[0],
                byte1: this.payload[1], 
                byte2: this.payload[2],
                byte3: this.payload[3]
            };
        }
        
        // Look for ASCII strings in the payload
        let asciiData = '';
        for (let i = 0; i < this.payload.length; i++) {
            const byte = this.payload[i];
            if (byte >= 32 && byte <= 126) {
                asciiData += String.fromCharCode(byte);
            } else {
                asciiData += '.';
            }
        }
        
        data.asciiView = asciiData;
        
        return data;
    }

    public toHTML(): string {
        const data = this.parse();
        
        let html = '<h3>⚙️ Settings Information</h3>';
        html += '<div class="data-grid">';
        html += `<div><strong>Payload Length:</strong> ${data.payloadLength} bytes</div>`;
        
        if (data.firstBytes) {
            html += `<div><strong>First 4 Bytes:</strong> 0x${data.firstBytes.byte0.toString(16).padStart(2, '0')} 0x${data.firstBytes.byte1.toString(16).padStart(2, '0')} 0x${data.firstBytes.byte2.toString(16).padStart(2, '0')} 0x${data.firstBytes.byte3.toString(16).padStart(2, '0')}</div>`;
        }
        
        html += `<div style="grid-column: 1 / -1;"><strong>ASCII View:</strong> ${data.asciiView}</div>`;
        html += `<div style="grid-column: 1 / -1;"><strong>Raw Data:</strong> ${data.rawData}</div>`;
        html += '</div>';
        
        return html;
    }
}