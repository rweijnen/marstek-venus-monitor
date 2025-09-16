import { BasePayload } from '../base/Payload.js';

export interface IMeterIP {
    ipAddress: string;
    isConfigured: boolean;
}

/**
 * Meter IP response parser (CMD 0x21)
 * Response contains a 16-byte ASCII IP address, NUL-terminated and zero-padded
 */
export class MeterIP extends BasePayload {
    public parse(): IMeterIP {
        // Get the 16-byte IP buffer from payload
        const ipBytes = this.payload.slice(0, Math.min(16, this.payloadLength));

        // Convert to string, stopping at first null byte
        let ipString = '';
        for (let i = 0; i < ipBytes.length; i++) {
            if (ipBytes[i] === 0) break;
            ipString += String.fromCharCode(ipBytes[i]);
        }

        // If all zeros or all 0xFF, no IP is configured
        const allZeros = ipBytes.every((b: number) => b === 0);
        const allFFs = ipBytes.every((b: number) => b === 0xFF);
        const isConfigured = !allZeros && !allFFs && ipString.length > 0;

        return {
            ipAddress: isConfigured ? ipString : 'Not configured',
            isConfigured: isConfigured
        };
    }

    public toHTML(): string {
        const data = this.parse();

        const statusIcon = data.isConfigured ? '✅' : '⚠️';

        return `
            <h3>🌐 P1 Meter IP (0x21)</h3>
            <div class="data-grid">
                <div><strong>IP Address:</strong> ${statusIcon} ${data.ipAddress}</div>
                <div><strong>Status:</strong> ${data.isConfigured ? 'Configured' : 'Not configured'}</div>
            </div>
        `;
    }
}