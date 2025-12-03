/**
 * BLE Lock Payload Parser (Command 0x53)
 * Handles BLE Lock status for Marstek Venus E devices (v156+)
 *
 * Protocol:
 * - Sub-command 0x0A: SET lock state (payload byte 0 = 0x0A, byte 1 = lock value)
 * - Sub-command 0x0B: GET lock state (payload byte 0 = 0x0B)
 *
 * Response format: [sub-command, lock_status]
 * - sub-command: 0x0A (set) or 0x0B (get)
 * - lock_status: 0 = unlocked, 1 = locked
 */

import { BasePayload } from '../base/Payload.js';

export interface IBLELockInfo {
    subCommand: number;      // 0x0A = SET, 0x0B = GET
    subCommandName: string;  // "SET" or "GET"
    lockStatus: number;      // 0 = unlocked, 1 = locked
    isLocked: boolean;       // true if locked
}

export class BLELockPayload extends BasePayload {
    public parse(): IBLELockInfo {
        if (this.payloadLength < 2) {
            throw new Error(`BLE Lock payload too short: ${this.payloadLength} bytes, need at least 2`);
        }

        const subCommand = this.readUint8(0x00);
        const lockStatus = this.readUint8(0x01);

        let subCommandName: string;
        switch (subCommand) {
            case 0x0A:
                subCommandName = 'SET';
                break;
            case 0x0B:
                subCommandName = 'GET';
                break;
            default:
                subCommandName = `Unknown (0x${subCommand.toString(16).padStart(2, '0')})`;
        }

        return {
            subCommand,
            subCommandName,
            lockStatus,
            isLocked: lockStatus === 1
        };
    }

    public toHTML(): string {
        try {
            const data = this.parse();

            let html = '<h3>BLE Lock Status (v156+)</h3><div class="data-grid">';

            html += `<div><strong>Operation:</strong> ${data.subCommandName}</div>`;

            const lockStatusText = data.isLocked ?
                '<span style="color: #dc3545;">LOCKED</span>' :
                '<span style="color: #28a745;">UNLOCKED</span>';
            html += `<div><strong>Lock Status:</strong> ${lockStatusText}</div>`;

            html += `<div><strong>Raw Value:</strong> ${data.lockStatus}</div>`;

            html += '</div>';
            return html;
        } catch (error) {
            return `<h3>BLE Lock Status</h3><div class="error">Failed to parse BLE Lock data: ${(error as Error).message}</div>`;
        }
    }
}
