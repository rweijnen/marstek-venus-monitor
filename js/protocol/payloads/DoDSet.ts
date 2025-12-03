/**
 * Backup Reserve / Discharge Capacity Payload Parser (Command 0x54)
 * Handles battery reserve configuration for Marstek Venus E devices (v156+)
 *
 * Protocol:
 * - Send: [discharge_capacity] (1 byte, valid range 30-88%)
 * - Response: [stored_discharge_capacity] (1 byte)
 *
 * Terminology:
 * - Discharge Capacity: What gets sent to device (30-88%)
 * - Backup Reserve: What the battery keeps in reserve (100 - Discharge Capacity = 12-70%)
 */

import { BasePayload } from '../base/Payload.js';

export interface IDoDSetInfo {
    dischargeCapacity: number;   // Discharge Capacity percentage (30-88%)
    backupReserve: number;       // Backup Reserve percentage (12-70%)
}

export class DoDSetPayload extends BasePayload {
    public parse(): IDoDSetInfo {
        if (this.payloadLength < 1) {
            throw new Error(`Backup Reserve payload too short: ${this.payloadLength} bytes, need at least 1`);
        }

        const dischargeCapacity = this.readUint8(0x00);

        return {
            dischargeCapacity,
            backupReserve: 100 - dischargeCapacity
        };
    }

    public toHTML(): string {
        try {
            const data = this.parse();

            let html = '<h3>Backup Reserve Set (v156+)</h3><div class="data-grid">';

            html += `<div><strong>Backup Reserve:</strong> ${data.backupReserve}%</div>`;
            html += `<div><strong>Discharge Capacity:</strong> ${data.dischargeCapacity}%</div>`;

            // Visual indicator based on backup reserve
            const reserveColor = data.backupReserve >= 50 ? '#28a745' :
                                data.backupReserve >= 30 ? '#ffc107' : '#dc3545';
            html += `<div><strong>Protection Level:</strong> <span style="color: ${reserveColor};">${
                data.backupReserve >= 50 ? 'High (battery protection)' :
                data.backupReserve >= 30 ? 'Medium' : 'Low (maximum capacity)'
            }</span></div>`;

            html += '</div>';
            return html;
        } catch (error) {
            return `<h3>Backup Reserve Set</h3><div class="error">Failed to parse data: ${(error as Error).message}</div>`;
        }
    }
}
