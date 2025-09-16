import { BasePayload } from '../base/Payload.js';
import { Header } from '../base/Header.js';
import { FrameParser } from '../base/FrameParser.js';

/**
 * Meter IP response parser (CMD 0x21)
 * Response contains a 16-byte ASCII IP address, NUL-terminated and zero-padded
 */
export class MeterIP extends BasePayload {
    private ipAddress: string;

    constructor(data: Uint8Array) {
        super();
        this.parse(data);
    }

    protected parse(data: Uint8Array): void {
        const parser = new FrameParser(data);
        this.header = parser.parseHeader();

        // Get the 16-byte IP buffer from payload
        const ipBytes = parser.getRemainingBytes(16);

        // Convert to string, stopping at first null byte
        let ipString = '';
        for (let i = 0; i < ipBytes.length; i++) {
            if (ipBytes[i] === 0) break;
            ipString += String.fromCharCode(ipBytes[i]);
        }

        // If all zeros, no IP is configured
        if (ipBytes.every(b => b === 0)) {
            this.ipAddress = 'Not configured';
        } else if (ipString.length > 0) {
            this.ipAddress = ipString;
        } else {
            this.ipAddress = 'Invalid response';
        }
    }

    public toHTML(): string {
        const header = this.header.toHTML();

        let statusClass = 'success';
        let statusIcon = '✅';

        if (this.ipAddress === 'Not configured') {
            statusClass = 'warning';
            statusIcon = '⚠️';
        } else if (this.ipAddress === 'Invalid response') {
            statusClass = 'error';
            statusIcon = '❌';
        }

        return `
            ${header}
            <h3>🌐 P1 Meter IP Configuration</h3>
            <div class="data-section">
                <div class="${statusClass}">
                    ${statusIcon} <strong>P1 Meter IP:</strong> ${this.ipAddress}
                </div>
                ${this.ipAddress !== 'Not configured' && this.ipAddress !== 'Invalid response' ? `
                <div class="info">
                    <small>The device will send power data to this P1 meter endpoint</small>
                </div>
                ` : ''}
            </div>
        `;
    }

    public toString(): string {
        return `P1 Meter IP: ${this.ipAddress}`;
    }
}