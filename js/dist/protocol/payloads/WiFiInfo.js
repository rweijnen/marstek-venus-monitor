/**
 * WiFi Info Payload Parser (Command 0x08)
 * Parses WiFi network SSID information
 */
import { BasePayload } from '../base/Payload.js';
export class WiFiInfoPayload extends BasePayload {
    parse() {
        // The payload is the WiFi SSID as a UTF-8 string
        const ssid = this.readString(0, this.payloadLength).trim();
        return {
            ssid: ssid || 'Not connected',
            connected: ssid.length > 0
        };
    }
    toHTML() {
        const data = this.parse();
        return `
            <h3>📶 WiFi Info (0x08)</h3>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Network (SSID):</span>
                    <span class="data-value">${data.ssid}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Status:</span>
                    <span class="data-value">${data.connected ? '🟢 Connected' : '🔴 Disconnected'}</span>
                </div>
            </div>
        `;
    }
}
