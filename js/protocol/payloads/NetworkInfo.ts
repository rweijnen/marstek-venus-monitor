/**
 * Network Info Payload Parser (Command 0x24)
 * Parses network configuration data including IP, gateway, mask, and DNS
 */

import { BasePayload } from '../base/Payload.js';

export interface INetworkInfo {
    ip?: string;
    gateway?: string;
    mask?: string;
    dns?: string;
    rawConfig?: string;
}

export class NetworkInfoPayload extends BasePayload {
    public parse(): INetworkInfo {
        // The payload contains a string with network configuration
        // Format: "ip:192.168.20.82,gate:192.168.20.1,mask:255.255.255.0,dns:192.168.20.1"
        
        if (this.payloadLength < 1) {
            return { rawConfig: 'No data available' };
        }

        // Read the entire payload as a string
        const configString = this.readString(0, this.payloadLength);
        
        // Parse the configuration string
        const result: INetworkInfo = {
            rawConfig: configString
        };
        
        // Split by comma to get individual fields
        const fields = configString.split(',');
        
        fields.forEach(field => {
            const [key, value] = field.split(':');
            if (key && value) {
                switch(key.toLowerCase().trim()) {
                    case 'ip':
                        result.ip = value.trim();
                        break;
                    case 'gate':
                    case 'gateway':
                        result.gateway = value.trim();
                        break;
                    case 'mask':
                        result.mask = value.trim();
                        break;
                    case 'dns':
                        result.dns = value.trim();
                        break;
                }
            }
        });
        
        return result;
    }

    public toHTML(): string {
        const data = this.parse();
        
        return `
            <h3>🌐 Network Info (0x24)</h3>
            <div class="data-grid">
                ${data.ip ? `
                <div class="data-item">
                    <span class="data-label">IP Address:</span>
                    <span class="data-value">${data.ip}</span>
                </div>
                ` : ''}
                ${data.gateway ? `
                <div class="data-item">
                    <span class="data-label">Gateway:</span>
                    <span class="data-value">${data.gateway}</span>
                </div>
                ` : ''}
                ${data.mask ? `
                <div class="data-item">
                    <span class="data-label">Subnet Mask:</span>
                    <span class="data-value">${data.mask}</span>
                </div>
                ` : ''}
                ${data.dns ? `
                <div class="data-item">
                    <span class="data-label">DNS Server:</span>
                    <span class="data-value">${data.dns}</span>
                </div>
                ` : ''}
                ${!data.ip && !data.gateway && !data.mask && !data.dns && data.rawConfig ? `
                <div class="data-item">
                    <span class="data-label">Raw Config:</span>
                    <span class="data-value">${data.rawConfig}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
}