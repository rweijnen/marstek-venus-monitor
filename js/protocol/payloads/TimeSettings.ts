import { BasePayload } from '../base/Payload.js';

/**
 * Time and power configuration payload (Command 0x0B)
 * Contains device time settings and power configuration parameters
 */
export class TimeSettings extends BasePayload {
    public parse() {
        // Parse time settings data based on firmware analysis
        let offset = 0;
        
        // Actual payload from device: [0x5e, 0x08, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]
        // Decimal: [94, 8, 0, 0, 2, 0, 0, 0]
        
        const value1 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x5e = 94
        const value2 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x08 = 8 
        const value3 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x00 = 0
        const value4 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x00 = 0
        const value5 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x02 = 2
        const value6 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x00 = 0
        const value7 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x00 = 0
        const value8 = offset < this.payload.length ? this.payload[offset++] : 0; // 0x00 = 0
        
        // Based on the data pattern, this doesn't look like a typical timestamp
        // Let's treat it as configuration values for now
        const year = 0; // Unknown format
        const month = 0;
        const day = 0;
        const hour = value4; // 2
        const minute = 0;
        const second = 0;
        
        // Map the 8 bytes to meaningful configuration values
        // Based on payload: [0x08 0x00 0x00 0x02 0x00 0x00 0x00 0x02]
        const powerConfig1 = value1; // 8
        const powerConfig2 = value2; // 0  
        const powerConfig3 = value3; // 0
        const powerConfig4 = value4; // 2
        const config5 = value5; // 0
        const config6 = value6; // 0
        const config7 = value7; // 0
        const config8 = value8; // 2

        return {
            type: 'TimeSettings',
            timestamp: 'Unknown format', // Need more data to determine actual timestamp format
            rawValues: [value1, value2, value3, value4, value5, value6, value7, value8],
            powerConfig1,
            powerConfig2,
            powerConfig3,
            powerConfig4,
            config5,
            config6,
            config7,
            config8
        };
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>Time & Power Settings</h3>
            <div class="data-grid">
                <div><strong>Timestamp:</strong> ${data.timestamp}</div>
                <div><strong>Raw Values:</strong> [${data.rawValues.join(', ')}]</div>
                <div><strong>Config 1:</strong> ${data.powerConfig1}</div>
                <div><strong>Config 2:</strong> ${data.powerConfig2}</div>
                <div><strong>Config 3:</strong> ${data.powerConfig3}</div>
                <div><strong>Config 4:</strong> ${data.powerConfig4}</div>
                <div><strong>Config 5:</strong> ${data.config5}</div>
                <div><strong>Config 6:</strong> ${data.config6}</div>
                <div><strong>Config 7:</strong> ${data.config7}</div>
                <div><strong>Config 8:</strong> ${data.config8}</div>
            </div>
        `;
    }
}