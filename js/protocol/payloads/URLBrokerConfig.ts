import { BasePayload } from '../base/Payload.js';

export interface URLBrokerData {
    xid: number;
    id: string;
    flg: number;
    url: string;
    port: number;
    user: string;
    pwd: string;
}

export class URLBrokerConfig extends BasePayload {

    private cipherDecode(encoded: string): string {
        let decoded = '';
        for (let i = 0; i < encoded.length; i++) {
            let char = encoded[i];
            
            // Swap + and /
            if (char === '+') {
                char = '/';
            } else if (char === '/') {
                char = '+';
            }
            // Shift letters and digits by -7
            else if (char >= 'A' && char <= 'Z') {
                const shifted = char.charCodeAt(0) - 7;
                char = String.fromCharCode(shifted < 65 ? shifted + 26 : shifted);
            } else if (char >= 'a' && char <= 'z') {
                const shifted = char.charCodeAt(0) - 7;
                char = String.fromCharCode(shifted < 97 ? shifted + 26 : shifted);
            } else if (char >= '0' && char <= '9') {
                const shifted = char.charCodeAt(0) - 7;
                char = String.fromCharCode(shifted < 48 ? shifted + 10 : shifted);
            }
            
            decoded += char;
        }
        return decoded;
    }

    private base64Decode(base64: string): string {
        try {
            // Use built-in atob for Base64 decoding
            return atob(base64);
        } catch (e) {
            console.warn('Base64 decode failed:', e);
            return base64; // Return original if decode fails
        }
    }

    private parseConfig(configString: string): URLBrokerData | null {
        try {
            const config: Partial<URLBrokerData> = {};
            
            // Parse key=value pairs
            const pairs = configString.split(',').map(p => p.trim());
            for (const pair of pairs) {
                const [key, value] = pair.split('=', 2);
                if (key && value !== undefined) {
                    switch (key.trim()) {
                        case 'xid':
                            config.xid = parseInt(value.trim());
                            break;
                        case 'id':
                            config.id = value.trim();
                            break;
                        case 'flg':
                            config.flg = parseInt(value.trim());
                            break;
                        case 'url':
                            config.url = value.trim();
                            break;
                        case 'port':
                            config.port = parseInt(value.trim());
                            break;
                        case 'user':
                            config.user = value.trim();
                            break;
                        case 'pwd':
                            config.pwd = value.trim();
                            break;
                    }
                }
            }

            return config as URLBrokerData;
        } catch (e) {
            console.warn('Config parsing failed:', e);
            return null;
        }
    }

    parse(): any {
        // Convert payload to ASCII string
        const rawAscii = Array.from(this.payload)
            .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
            .join('');

        // Cipher decode 
        const cipherDecoded = this.cipherDecode(rawAscii);

        // Base64 decode
        let base64Decoded = '';
        try {
            base64Decoded = this.base64Decode(cipherDecoded);
        } catch (e) {
            base64Decoded = `[Base64 decode failed: ${e}]`;
        }

        // Parse final config
        const config = this.parseConfig(base64Decoded);

        return {
            payloadSize: this.payload.length,
            processing: {
                rawAscii: rawAscii,
                cipherDecoded: cipherDecoded,
                base64Decoded: base64Decoded
            },
            config: config
        };
    }

    toHTML(): string {
        const data = this.parse();
        
        let html = `
            <div class="url-broker-config-container">
                <div class="summary">
                    <h3>🔗 URL Broker Config Response</h3>
                    <p>Payload Size: <strong>${data.payloadSize}</strong> bytes</p>
                </div>

                <div class="processing-stages">
                    <h4>🔧 Processing Stages:</h4>
                    
                    <div class="stage">
                        <strong>1. Raw Data (ASCII):</strong>
                        <code>${data.processing.rawAscii}</code>
                    </div>
                    
                    <div class="stage">
                        <strong>2. Decoded Data:</strong>
                        <code>${data.processing.cipherDecoded}</code>
                    </div>
                    
                    <div class="stage">
                        <strong>3. Base64 Decoded:</strong>
                        <code>${data.processing.base64Decoded}</code>
                    </div>
                </div>
        `;

        if (data.config) {
            html += `
                <div class="final-config">
                    <h4>⚙️ Final Configuration:</h4>
                    <table class="data-table">
                        <tr><td><strong>XID:</strong></td><td>${data.config.xid || 'N/A'}</td></tr>
                        <tr><td><strong>ID:</strong></td><td>${data.config.id || 'N/A'}</td></tr>
                        <tr><td><strong>Flag:</strong></td><td>${data.config.flg || 'N/A'}</td></tr>
                        <tr><td><strong>URL:</strong></td><td>${data.config.url || 'N/A'}</td></tr>
                        <tr><td><strong>Port:</strong></td><td>${data.config.port || 'N/A'}</td></tr>
                        <tr><td><strong>User:</strong></td><td>${data.config.user || 'N/A'}</td></tr>
                        <tr><td><strong>Password:</strong></td><td>${data.config.pwd || 'N/A'}</td></tr>
                    </table>
                </div>
            `;
        }

        html += `</div>`;
        
        return html;
    }
}