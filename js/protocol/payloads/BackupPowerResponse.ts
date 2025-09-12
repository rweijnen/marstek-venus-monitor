import { BasePayload } from '../base/Payload.js';

/**
 * Backup Power Response payload (Command 0x0F)
 * Response to Enable/Disable EPS (Emergency Power Supply) commands
 */
export class BackupPowerResponse extends BasePayload {
    public parse() {
        // Response is typically 1 byte: 0x01 = enabled, 0x00 = disabled
        const status = this.payload.length > 0 ? this.payload[0] : 0xFF;
        
        let message = '';
        let enabled = false;
        
        if (status === 0x01) {
            message = 'Backup Power (EPS) enabled';
            enabled = true;
        } else if (status === 0x00) {
            message = 'Backup Power (EPS) disabled';
            enabled = false;
        } else {
            message = `Unknown status: 0x${status.toString(16).padStart(2, '0')}`;
        }
        
        return {
            type: 'BackupPowerResponse',
            status,
            enabled,
            message
        };
    }

    public toHTML(): string {
        const data = this.parse();
        
        const icon = data.enabled ? '🔋' : '⚡';
        const statusText = data.enabled ? 'ENABLED' : 'DISABLED';
        const statusClass = data.enabled ? 'enabled' : 'disabled';
        
        return `
            <h3>${icon} Backup Power Response</h3>
            <div class="data-grid">
                <div><strong>Status:</strong> <span style="color: ${data.enabled ? '#28a745' : '#6c757d'};">${statusText}</span></div>
                <div><strong>Message:</strong> ${data.message}</div>
                <div><strong>Response Code:</strong> 0x${data.status.toString(16).padStart(2, '0').toUpperCase()}</div>
            </div>
        `;
    }
}