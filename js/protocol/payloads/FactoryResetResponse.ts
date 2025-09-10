import { BasePayload } from '../base/Payload.js';

/**
 * Factory reset response payload (Command 0x06)
 * Contains factory reset operation status
 */
export class FactoryResetResponse extends BasePayload {
    public parse() {
        // Parse factory reset response
        const resetType = this.payload.length > 0 ? this.payload[0] : 0;
        const status = this.payload.length > 1 ? this.payload[1] : 0;

        return {
            type: 'FactoryResetResponse',
            resetType,
            resetTypeDescription: this.getResetTypeDescription(resetType),
            status,
            statusDescription: this.getStatusDescription(status),
            message: this.getResetMessage(resetType, status)
        };
    }

    private getResetTypeDescription(resetType: number): string {
        switch (resetType) {
            case 1: return 'WiFi Settings Reset';
            case 2: return 'Complete Factory Reset';
            default: return 'Unknown Reset Type';
        }
    }

    private getStatusDescription(status: number): string {
        switch (status) {
            case 0: return 'Failed';
            case 1: return 'Success';
            default: return 'Unknown Status';
        }
    }

    private getResetMessage(resetType: number, status: number): string {
        const typeDesc = this.getResetTypeDescription(resetType);
        const statusDesc = this.getStatusDescription(status);
        return `${typeDesc}: ${statusDesc}`;
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>Factory Reset Response</h3>
            <div class="data-grid">
                <div><strong>Reset Type:</strong> ${data.resetType} (${data.resetTypeDescription})</div>
                <div><strong>Status:</strong> ${data.status} (${data.statusDescription})</div>
                <div><strong>Message:</strong> ${data.message}</div>
            </div>
        `;
    }
}