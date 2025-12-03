/**
 * Device Config Read Payload Parser (Command 0x51)
 * Handles read responses for VID, GID, and XID configuration
 *
 * Firmware reference (case 81):
 * - Sub 0x0C: Read VID (Vendor ID string)
 * - Sub 0x0D: Read GID (Group ID with ID number + string)
 * - Sub 0x0E: Read XID (Extended ID configuration)
 */

import { BasePayload } from '../base/Payload.js';

export interface IDeviceConfigRead {
    subCommand: number;
    operation: string;
    data?: string;
    id?: number;
    success: boolean;
}

export class DeviceConfigRead extends BasePayload {
    public parse(): IDeviceConfigRead {
        if (this.payloadLength < 1) {
            throw new Error(`Device config read payload too short: ${this.payloadLength} bytes`);
        }

        const subCommand = this.readUint8(0);
        let operation = 'Unknown';
        let data: string | undefined;
        let id: number | undefined;
        let success = false;

        switch (subCommand) {
            case 0x0C: // Read VID response
                operation = 'VID (Vendor ID)';
                if (this.payloadLength > 1) {
                    data = this.readString(1, this.payloadLength - 1).replace(/\0+$/, '');
                    success = data.length > 0;
                }
                break;

            case 0x0D: // Read GID response
                operation = 'GID (Group ID)';
                if (this.payloadLength > 2) {
                    id = this.readUint8(1);
                    data = this.readString(2, this.payloadLength - 2).replace(/\0+$/, '');
                    success = data.length > 0;
                } else if (this.payloadLength > 1) {
                    id = this.readUint8(1);
                    success = false;
                }
                break;

            case 0x0E: // Read XID response
                operation = 'XID (Extended ID)';
                if (this.payloadLength > 2) {
                    id = this.readUint8(1);
                    data = this.readString(2, this.payloadLength - 2).replace(/\0+$/, '');
                    success = data.length > 0;
                } else if (this.payloadLength > 1) {
                    id = this.readUint8(1);
                    success = false;
                }
                break;

            case 0x00: // Empty/error response
                operation = 'Empty Response';
                success = false;
                break;

            default:
                operation = `Unknown Sub-Command 0x${subCommand.toString(16).padStart(2, '0')}`;
                // Check if there's string data anyway
                if (this.payloadLength > 1) {
                    data = this.readString(1, this.payloadLength - 1).replace(/\0+$/, '');
                }
                break;
        }

        return {
            subCommand,
            operation,
            data,
            id,
            success
        };
    }

    public toHTML(): string {
        try {
            const config = this.parse();

            let html = '<h3>Device Config Read Response</h3><div class="data-grid">';

            html += `<div><strong>Operation:</strong> ${config.operation}</div>`;
            html += `<div><strong>Sub-Command:</strong> 0x${config.subCommand.toString(16).padStart(2, '0').toUpperCase()}</div>`;

            if (config.id !== undefined) {
                html += `<div><strong>ID:</strong> ${config.id}</div>`;
            }

            if (config.data !== undefined && config.data.length > 0) {
                html += `<div><strong>Data:</strong> ${config.data}</div>`;
            } else {
                html += `<div><strong>Data:</strong> <em>(not configured)</em></div>`;
            }

            const statusIcon = config.success ? 'OK' : 'Empty/Not Set';
            html += `<div><strong>Status:</strong> ${statusIcon}</div>`;

            html += '</div>';

            return html;
        } catch (error) {
            return `<h3>Device Config Read Response</h3><div class="error">Failed to parse: ${(error as Error).message}</div>`;
        }
    }
}
