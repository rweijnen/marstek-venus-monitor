import { BasePayload } from '../base/Payload.js';

/**
 * Time settings response payload (Command 0x0B)
 * Device echoes back the set time with day-of-week calculation
 *
 * Response format (8 bytes):
 * - Bytes 0-1: Year (little-endian, full year)
 * - Byte 2: Month (1-12)
 * - Byte 3: Day (1-31)
 * - Byte 4: Day of week (1=Monday, 7=Sunday, calculated by device)
 * - Byte 5: Hour (0-23)
 * - Byte 6: Minute (0-59)
 * - Byte 7: Second (0-59)
 */
export class TimeSettings extends BasePayload {
    public parse() {
        // Parse time confirmation response
        let offset = 0;

        // Check if we have enough bytes for time response
        if (this.payload.length < 8) {
            return {
                type: 'TimeSettings',
                error: 'Invalid payload length',
                rawData: Array.from(this.payload).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
            };
        }

        // Parse time fields from response
        const yearLow = this.payload[offset++];
        const yearHigh = this.payload[offset++];
        const year = yearLow | (yearHigh << 8);

        const month = this.payload[offset++];
        const day = this.payload[offset++];
        const dayOfWeek = this.payload[offset++];
        const hour = this.payload[offset++];
        const minute = this.payload[offset++];
        const second = this.payload[offset++];

        // Day of week names
        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayName = dayOfWeek >= 1 && dayOfWeek <= 7 ? dayNames[dayOfWeek] : 'Unknown';

        // Format timestamp
        const timestamp = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ` +
                         `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;

        return {
            type: 'TimeSettings',
            year,
            month,
            day,
            dayOfWeek,
            dayName,
            hour,
            minute,
            second,
            timestamp,
            success: true
        };
    }

    public toHTML(): string {
        const data = this.parse();

        // Handle error case
        if (data.error) {
            return `
                <h3>⚠️ Time Settings Response</h3>
                <div class="data-grid">
                    <div><strong>Error:</strong> ${data.error}</div>
                    <div><strong>Raw Data:</strong> ${data.rawData}</div>
                </div>
            `;
        }

        return `
            <h3>✅ Device Time Set Successfully</h3>
            <div class="data-grid">
                <div><strong>Date:</strong> ${data.year}-${data.month.toString().padStart(2, '0')}-${data.day.toString().padStart(2, '0')}</div>
                <div><strong>Time:</strong> ${data.hour.toString().padStart(2, '0')}:${data.minute.toString().padStart(2, '0')}:${data.second.toString().padStart(2, '0')}</div>
                <div><strong>Day of Week:</strong> ${data.dayName} (${data.dayOfWeek})</div>
                <div><strong>Full Timestamp:</strong> ${data.timestamp}</div>
            </div>
            <div style="margin-top: 10px; padding: 10px; background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
                <strong>ℹ️ Note:</strong> Device clock has been updated. This may affect daily/monthly energy counter resets and event log timestamps.
            </div>
        `;
    }
}