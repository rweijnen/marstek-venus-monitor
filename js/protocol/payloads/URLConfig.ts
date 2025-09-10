import { BasePayload } from '../base/Payload.js';

/**
 * URL and port configuration payload (Command 0x1B)
 * Contains server URL and port settings
 */
export class URLConfig extends BasePayload {
    public parse() {
        // Parse URL configuration data
        let offset = 0;
        
        // URL length and string
        const urlLength = this.payload[offset++];
        const url = new TextDecoder().decode(this.payload.slice(offset, offset + urlLength));
        offset += urlLength;
        
        // Port (2 bytes)
        const port = offset + 1 < this.payload.length ? this.readUint16LE(offset) : 0;
        offset += 2;
        
        // Protocol/enabled flags
        const protocol = offset < this.payload.length ? (this.payload[offset] === 1 ? 'https' : 'http') : 'http';
        offset++;
        const enabled = offset < this.payload.length ? this.payload[offset] === 1 : false;

        return {
            type: 'URLConfig',
            url,
            port,
            protocol,
            enabled,
            fullUrl: `${protocol}://${url}:${port}`
        };
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>URL Configuration</h3>
            <div class="data-grid">
                <div><strong>URL:</strong> ${data.url}</div>
                <div><strong>Port:</strong> ${data.port}</div>
                <div><strong>Protocol:</strong> ${data.protocol}</div>
                <div><strong>Enabled:</strong> ${data.enabled ? 'Yes' : 'No'}</div>
                <div><strong>Full URL:</strong> ${data.fullUrl}</div>
            </div>
        `;
    }
}