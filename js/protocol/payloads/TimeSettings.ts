import { BasePayload } from '../base/Payload.js';

/**
 * Time and power configuration payload (Command 0x0B)
 * Contains device time settings and power configuration parameters
 */
export class TimeSettings extends BasePayload {
    public parse() {
        // Parse time settings data based on firmware analysis
        let offset = 0;
        
        // Time data (6 bytes)
        const year = this.readUint16LE(offset) + 2000; // Year offset
        offset += 2;
        const month = this.payload[offset++];
        const day = this.payload[offset++];
        const hour = this.payload[offset++];
        const minute = this.payload[offset++];
        const second = offset < this.payload.length ? this.payload[offset++] : 0;
        
        // Power configuration parameters
        const powerConfig1 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0;
        offset += 2;
        const powerConfig2 = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0;
        offset += 2;
        const powerConfig3 = offset < this.payload.length ? this.payload[offset++] : 0;
        const powerConfig4 = offset < this.payload.length ? this.payload[offset++] : 0;

        return {
            type: 'TimeSettings',
            timestamp: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`,
            year,
            month,
            day,
            hour,
            minute,
            second,
            powerConfig1,
            powerConfig2,
            powerConfig3,
            powerConfig4
        };
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>Time & Power Settings</h3>
            <div class="data-grid">
                <div><strong>Timestamp:</strong> ${data.timestamp}</div>
                <div><strong>Power Config 1:</strong> ${data.powerConfig1}</div>
                <div><strong>Power Config 2:</strong> ${data.powerConfig2}</div>
                <div><strong>Power Config 3:</strong> ${data.powerConfig3}</div>
                <div><strong>Power Config 4:</strong> ${data.powerConfig4}</div>
            </div>
        `;
    }
}