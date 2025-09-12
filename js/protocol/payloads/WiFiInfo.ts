/**
 * WiFi Info Payload Parser (Command 0x08)
 * Parses WiFi network SSID information
 */

import { BasePayload } from '../base/Payload.js';

export interface IWiFiInfo {
    ssid: string;
    connected: boolean;
}

export class WiFiInfoPayload extends BasePayload {
    public parse(): IWiFiInfo {
        // The payload is the WiFi SSID as a UTF-8 string
        const ssid = this.readString(0, this.payloadLength).trim();
        
        return {
            ssid: ssid || 'Not connected',
            connected: ssid.length > 0
        };
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>📶 WiFi Info (0x08)</h3>
            <div class="data-grid">
                <div><strong>Network (SSID):</strong> ${data.ssid}</div>
                <div><strong>Status:</strong> ${data.connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
            </div>
        `;
    }
}