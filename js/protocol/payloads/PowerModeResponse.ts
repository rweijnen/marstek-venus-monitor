import { BasePayload } from '../base/Payload.js';

/**
 * Power Mode Response payload (Command 0x15)
 * Response to power mode setting commands (800W/2500W)
 */
export class PowerModeResponse extends BasePayload {
    public parse() {
        // Response is typically 1 byte: 0x00 = success, 0x01 = already set/no change
        const status = this.payload.length > 0 ? this.payload[0] : 0xFF;
        
        // Try to determine what mode was set based on the request
        // This would need to be enhanced with request tracking
        let message = '';
        if (status === 0x00) {
            message = 'Power mode changed successfully';
        } else if (status === 0x01) {
            message = 'Power mode already set (no change needed)';
        } else {
            message = `Response code: 0x${status.toString(16).padStart(2, '0')}`;
        }
        
        return {
            type: 'PowerModeResponse',
            status,
            success: status === 0x00 || status === 0x01,
            message
        };
    }

    public toHTML(): string {
        const data = this.parse();
        
        const icon = data.success ? '✅' : '⚠️';
        const statusClass = data.success ? 'success' : 'warning';
        
        return `
            <h3>⚡ Power Mode Setting Response</h3>
            <div class="data-grid">
                <div><strong>Status:</strong> ${icon} ${data.message}</div>
                <div><strong>Response Code:</strong> 0x${data.status.toString(16).padStart(2, '0').toUpperCase()}</div>
            </div>
        `;
    }
}