/**
 * Payload Factory
 * Creates appropriate payload parser based on command type
 */

import { BasePayload } from '../base/Payload.js';
import { CommandType } from '../base/types.js';
import { RuntimeInfoPayload } from './RuntimeInfo.js';
import { DeviceInfoPayload } from './DeviceInfo.js';

export function createPayload(data: Uint8Array): BasePayload {
    if (data.length < 4) {
        throw new Error('Data too short to determine command type');
    }

    const command = data[3]; // Command byte at index 3

    switch (command) {
        case CommandType.RUNTIME_INFO:
            return new RuntimeInfoPayload(data);
            
        case CommandType.DEVICE_INFO:
            return new DeviceInfoPayload(data);
        
        // Add other payload types as we implement them
        // case CommandType.BMS_DATA:
        //     return new BMSDataPayload(data);
        
        default:
            // For unimplemented commands, create a generic payload
            return new GenericPayload(data);
    }
}

// Generic payload for commands we haven't implemented yet
class GenericPayload extends BasePayload {
    public parse(): any {
        return {
            command: `0x${this.commandType.toString(16).padStart(2, '0').toUpperCase()}`,
            commandName: this.commandName,
            payloadLength: this.payloadLength,
            rawData: Array.from(this.payload.slice(0, Math.min(16, this.payloadLength)))
                .map(b => `0x${b.toString(16).padStart(2, '0')}`)
                .join(' ')
        };
    }

    public toHTML(): string {
        const data = this.parse();
        return `
            <h3>${data.commandName} (${data.command})</h3>
            <div class="data-grid">
                <div><strong>Payload Length:</strong> ${data.payloadLength} bytes</div>
                <div><strong>Raw Data:</strong> ${data.rawData}${this.payloadLength > 16 ? '...' : ''}</div>
            </div>
        `;
    }
}

export { RuntimeInfoPayload, DeviceInfoPayload };