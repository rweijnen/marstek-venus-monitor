/**
 * Marstek Venus E Protocol Header Parser
 * Handles frame header validation and parsing
 */

import { IFrameHeader, PROTOCOL_CONSTANTS, CommandType } from './types.js';

export class FrameHeader implements IFrameHeader {
    public readonly startByte: number;
    public readonly length: number;
    public readonly identifier: number;
    public readonly command: number;
    public readonly checksum: number;
    public readonly isValid: boolean;

    constructor(data: Uint8Array) {
        if (data.length < 5) {
            throw new Error(`Frame too short: ${data.length} bytes, minimum 5 required`);
        }

        this.startByte = data[0];
        this.length = data[1];
        this.identifier = data[2];
        this.command = data[3];
        this.checksum = data[data.length - 1];

        // Validate frame structure
        this.isValid = this.validateFrame(data);
    }

    private validateFrame(data: Uint8Array): boolean {
        // Check start byte
        if (this.startByte !== PROTOCOL_CONSTANTS.START_BYTE) {
            console.warn(`Invalid start byte: 0x${this.startByte.toString(16)}, expected 0x${PROTOCOL_CONSTANTS.START_BYTE.toString(16)}`);
            return false;
        }

        // Check identifier
        if (this.identifier !== PROTOCOL_CONSTANTS.IDENTIFIER) {
            console.warn(`Invalid identifier: 0x${this.identifier.toString(16)}, expected 0x${PROTOCOL_CONSTANTS.IDENTIFIER.toString(16)}`);
            return false;
        }

        // Check length matches actual data
        if (this.length !== data.length) {
            console.warn(`Length mismatch: header says ${this.length}, got ${data.length}`);
            return false;
        }

        // Verify XOR checksum (include start byte)
        let calculatedChecksum = 0;
        for (let i = 0; i < data.length - 1; i++) {
            calculatedChecksum ^= data[i];
        }

        if (calculatedChecksum !== this.checksum) {
            console.warn(`Checksum mismatch: calculated 0x${calculatedChecksum.toString(16)}, got 0x${this.checksum.toString(16)}`);
            return false;
        }

        return true;
    }

    public getPayload(data: Uint8Array): Uint8Array {
        if (!this.isValid) {
            throw new Error('Cannot extract payload from invalid frame');
        }
        
        const startIndex = PROTOCOL_CONSTANTS.HEADER_SIZE;
        const endIndex = data.length - PROTOCOL_CONSTANTS.CHECKSUM_SIZE;
        
        return data.slice(startIndex, endIndex);
    }

    public getCommandName(): string {
        const commandNames: Record<number, string> = {
            [CommandType.RUNTIME_INFO]: 'Runtime Info',
            [CommandType.DEVICE_INFO]: 'Device Info',
            [CommandType.URL_BROKER_CONFIG]: 'URL Broker Config',
            [CommandType.WIFI_INFO]: 'WiFi Info',
            [CommandType.SYSTEM_DATA]: 'Developer Mode Info',
            [CommandType.BLE_EVENT_LOG]: 'BLE Event Log',
            [CommandType.OTA_ACTIVATION]: 'OTA Activation',
            [CommandType.BMS_DATA]: 'BMS Data',
            [CommandType.CONFIG_DATA]: 'Config Data',
            [CommandType.HM_SUMMARY]: 'HM Summary',
            [CommandType.HM_EVENT_LOG]: 'HM Event Log',
            [CommandType.METER_IP]: 'Meter IP',
            [CommandType.CT_POLLING_RATE]: 'CT Polling Rate',
            [CommandType.NETWORK_INFO]: 'Network Info',
            [CommandType.LOCAL_API_STATUS]: 'Local API Status',
            [CommandType.URL_BROKER_RESPONSE]: 'URL Broker Response'
        };

        return commandNames[this.command] || `Unknown Command (0x${this.command.toString(16).padStart(2, '0').toUpperCase()})`;
    }

    public toString(): string {
        return `Frame[${this.getCommandName()}]: ${this.length} bytes, ${this.isValid ? 'valid' : 'invalid'}`;
    }
}