/**
 * Device Info Payload Parser (Command 0x04)
 * Handles parsing of device information from Marstek Venus E devices
 */
import { BasePayload } from '../base/Payload.js';
export class DeviceInfoPayload extends BasePayload {
    parse() {
        // Device info is returned as ASCII key-value pairs
        // Format: "type=HMG-50,id=2,sn=ABC123,mac=00:11:22:33:44:55,fw=1.0,hw=1.0"
        const payloadText = this.readString(0, this.payloadLength);
        console.log('Device Info payload text:', payloadText);
        const deviceInfo = {
            type: '',
            id: '',
            sn: '',
            mac: '',
            fw: '',
            hw: '',
            dev_ver: '',
            bms_ver: '',
            fc_ver: ''
        };
        // Parse key-value pairs separated by commas
        const pairs = payloadText.split(',');
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key && value) {
                const trimmedKey = key.trim();
                const trimmedValue = value.trim();
                // Map common keys to known fields
                switch (trimmedKey.toLowerCase()) {
                    case 'type':
                        deviceInfo.type = trimmedValue;
                        break;
                    case 'id':
                        deviceInfo.id = trimmedValue;
                        break;
                    case 'sn':
                        deviceInfo.sn = trimmedValue;
                        break;
                    case 'mac':
                        deviceInfo.mac = trimmedValue;
                        break;
                    case 'fw':
                        deviceInfo.fw = trimmedValue;
                        break;
                    case 'hw':
                        deviceInfo.hw = trimmedValue;
                        break;
                    case 'dev_ver':
                        deviceInfo.dev_ver = trimmedValue;
                        break;
                    case 'bms_ver':
                        deviceInfo.bms_ver = trimmedValue;
                        break;
                    case 'fc_ver':
                        deviceInfo.fc_ver = trimmedValue;
                        break;
                    default:
                        // Store any additional key-value pairs
                        deviceInfo[trimmedKey] = trimmedValue;
                        break;
                }
            }
        }
        return deviceInfo;
    }
    toHTML() {
        try {
            const data = this.parse();
            let html = '<h3>📱 Device Information</h3><div class="data-grid">';
            // Display known fields first
            if (data.type)
                html += `<div><strong>Device Type:</strong> ${data.type}</div>`;
            if (data.id)
                html += `<div><strong>Device ID:</strong> ${data.id}</div>`;
            if (data.sn)
                html += `<div><strong>Serial Number:</strong> ${data.sn}</div>`;
            if (data.mac)
                html += `<div><strong>MAC Address:</strong> ${data.mac}</div>`;
            if (data.fw)
                html += `<div><strong>Firmware Version:</strong> ${data.fw}</div>`;
            if (data.hw)
                html += `<div><strong>Hardware Version:</strong> ${data.hw}</div>`;
            if (data.dev_ver)
                html += `<div><strong>Device Version:</strong> ${data.dev_ver}</div>`;
            if (data.bms_ver)
                html += `<div><strong>BMS Version:</strong> ${data.bms_ver}</div>`;
            if (data.fc_ver)
                html += `<div><strong>FC Version:</strong> ${data.fc_ver}</div>`;
            // Display any additional fields
            const knownKeys = ['type', 'id', 'sn', 'mac', 'fw', 'hw', 'dev_ver', 'bms_ver', 'fc_ver'];
            for (const [key, value] of Object.entries(data)) {
                if (!knownKeys.includes(key) && typeof value === 'string' && value.length > 0) {
                    const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
                    html += `<div><strong>${displayKey}:</strong> ${value}</div>`;
                }
            }
            html += '</div>';
            return html;
        }
        catch (error) {
            return `<h3>📱 Device Information</h3><div class="error">Failed to parse device info: ${error.message}</div>`;
        }
    }
}
