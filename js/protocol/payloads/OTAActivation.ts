import { BasePayload } from '../base/Payload.js';

/**
 * OTA activation payload (Command 0x13)
 * Contains upgrade mode activation response and status
 */
export class OTAActivation extends BasePayload {
    public parse() {
        let offset = 0;
        
        // Parse OTA activation response
        const status = this.payload.length > 0 ? this.payload[offset++] : 0;
        const parameters: number[] = [];
        
        // Additional parameters if present
        while (offset < this.payload.length) {
            parameters.push(this.payload[offset++]);
        }

        return {
            type: 'OTAActivation',
            status,
            statusDescription: this.getStatusDescription(status),
            parameters,
            success: status === 0x01 || status === 0x00 // Common success values
        };
    }

    private getStatusDescription(status: number): string {
        switch (status) {
            case 0x00: return 'Ready';
            case 0x01: return 'Activated';
            case 0xFF: return 'Failed';
            default: return `Status ${status}`;
        }
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>OTA Activation Response</h3>
            <div class="data-grid">
                <div><strong>Status:</strong> 0x${data.status.toString(16).padStart(2, '0')} (${data.statusDescription})</div>
                <div><strong>Success:</strong> ${data.success ? 'Yes' : 'No'}</div>
                ${data.parameters.length > 0 ? `<div><strong>Parameters:</strong> [${data.parameters.map(p => `0x${p.toString(16).padStart(2, '0')}`).join(', ')}]</div>` : ''}
            </div>
        `;
    }
}