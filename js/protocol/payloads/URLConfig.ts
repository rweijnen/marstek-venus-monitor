import { BasePayload } from '../base/Payload.js';

/**
 * URL and port configuration payload (Command 0x1B)
 * Contains server URL and port settings
 */
export class URLConfig extends BasePayload {
    public parse() {
        // Check if this is a 0x51 response (different format)
        if (this.commandType === 0x51) {
            return this.parse0x51Response();
        }
        
        // Parse standard URL configuration data (0x1B response)
        let offset = 0;
        
        // URL length and string
        const urlLength = this.payload[offset++];
        
        // Validate URL length is reasonable
        if (urlLength > this.payload.length - 1 || urlLength > 100) {
            // Possibly encoded or different format, show raw data
            return this.parseRawData();
        }
        
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

    private parse0x51Response() {
        // Handle 0x51 response format
        const rawString = Array.from(this.payload)
            .map(b => String.fromCharCode(b))
            .join('');
        
        return {
            type: 'URLConfig_0x51',
            responseCommand: '0x51',
            rawData: rawString,
            payloadLength: this.payload.length
        };
    }

    private parseRawData() {
        // Fallback for unrecognized formats
        const rawString = Array.from(this.payload)
            .map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : `[0x${b.toString(16).padStart(2, '0')}]`)
            .join('');
        
        return {
            type: 'URLConfig_Raw',
            rawString,
            hexData: Array.from(this.payload).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
            payloadLength: this.payload.length
        };
    }

    public toHTML(): string {
        const data = this.parse();
        
        // Handle different response types
        if (data.type === 'URLConfig_0x51') {
            return `
                <h3>URL Configuration (0x51 Response)</h3>
                <div class="data-grid">
                    <div><strong>Response Type:</strong> ${data.responseCommand}</div>
                    <div><strong>ASCII Data:</strong> ${data.rawData}</div>
                    <div><strong>Payload Length:</strong> ${data.payloadLength} bytes</div>
                </div>
            `;
        }
        
        if (data.type === 'URLConfig_Raw') {
            return `
                <h3>URL Configuration (Raw Data)</h3>
                <div class="data-grid">
                    <div><strong>Raw String:</strong> ${data.rawString}</div>
                    <div><strong>Hex Data:</strong> ${data.hexData}</div>
                    <div><strong>Payload Length:</strong> ${data.payloadLength} bytes</div>
                </div>
            `;
        }
        
        // Standard URL configuration
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