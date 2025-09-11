/**
 * Device Config Payload Parser (Command 0x50)
 * Handles device configuration operations including VID, GID, and XID settings
 */

import { BasePayload } from '../base/Payload.js';

export interface IDeviceConfig {
    subCommand: number;
    operation: string;
    data?: string | number;
    success?: boolean;
}

export class DeviceConfig extends BasePayload {
    public parse(): IDeviceConfig {
        if (this.payloadLength < 1) {
            throw new Error(`Device config payload too short: ${this.payloadLength} bytes, need at least 1`);
        }

        const subCommand = this.readUint8(0);
        let operation = 'Unknown';
        let data: string | number | undefined;
        let success = false;

        // Check if this is a response (first byte might be status/data)
        // For read responses, the data comes after sub-command
        
        switch (subCommand) {
            case 0x0A: // Write VID info response
                operation = 'Write VID Info';
                if (this.payloadLength > 1) {
                    data = this.readString(1, this.payloadLength - 1);
                    success = true;
                }
                break;
                
            case 0x0B: // Write GID info response
                operation = 'Write GID Info';
                if (this.payloadLength > 2) {
                    const id = this.readUint8(1);
                    const info = this.readString(2, this.payloadLength - 2);
                    data = `ID: ${id}, Info: ${info}`;
                    success = true;
                }
                break;
                
            case 0x0C: // Write XID config
                operation = 'Write XID Config';
                if (this.payloadLength > 1) {
                    // XID config contains power and meter data
                    const configData = Array.from(this.payload.slice(1))
                        .map(b => `0x${b.toString(16).padStart(2, '0')}`)
                        .join(' ');
                    data = configData;
                    success = true;
                }
                break;
                
            case 0x0D: // Read operations response
                if (this.payloadLength > 1) {
                    const readType = this.readUint8(1);
                    // If there's data after the read type, it's the response
                    if (this.payloadLength > 2) {
                        const responseData = this.readString(2, this.payloadLength - 2);
                        switch (readType) {
                            case 1:
                                operation = 'VID Info';
                                data = responseData;
                                break;
                            case 2:
                                operation = 'GID Info';
                                data = responseData;
                                break;
                            case 3:
                                operation = 'XID Config';
                                data = responseData;
                                break;
                            default:
                                operation = 'Read Config Response';
                                data = responseData;
                        }
                        success = true;
                    } else {
                        // Just the read command acknowledgment
                        switch (readType) {
                            case 1:
                                operation = 'Read VID Request';
                                break;
                            case 2:
                                operation = 'Read GID Request';
                                break;
                            case 3:
                                operation = 'Read XID Request';
                                break;
                            default:
                                operation = 'Read Request';
                        }
                        success = true;
                    }
                }
                break;
                
            default:
                operation = `Unknown Sub-Command 0x${subCommand.toString(16).padStart(2, '0')}`;
                break;
        }

        return {
            subCommand,
            operation,
            data,
            success
        };
    }

    public toHTML(): string {
        try {
            const config = this.parse();
            
            let html = '<h3>⚙️ Device Configuration</h3><div class="data-grid">';
            
            html += `<div><strong>Operation:</strong> ${config.operation}</div>`;
            html += `<div><strong>Sub-Command:</strong> 0x${config.subCommand.toString(16).padStart(2, '0').toUpperCase()}</div>`;
            
            if (config.data !== undefined) {
                html += `<div><strong>Data:</strong> ${config.data}</div>`;
            }
            
            const statusIcon = config.success ? '✅' : '❌';
            const statusText = config.success ? 'Success' : 'Failed/Unknown';
            html += `<div><strong>Status:</strong> ${statusIcon} ${statusText}</div>`;
            
            html += '</div>';
            
            return html;
        } catch (error) {
            return `<h3>⚙️ Device Configuration</h3><div class="error">Failed to parse config data: ${(error as Error).message}</div>`;
        }
    }
}